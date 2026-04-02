const API_URL = 'http://localhost:5000/api';

// --- STATE ---
let currentPin = "1234";
let masterKey = "1234";
let vaultData = [];
let auditLogs = [];
let currentUserRole = null;
let currentStudent = { name: '', id: '' };
let pendingBorrowId = null;

// --- INITIALIZE FROM BACKEND ---
async function initApp() {
    try {
        // 1. Fetch Config (PIN & Master Key)
        const configRes = await fetch(`${API_URL}/config`);
        const config = await configRes.json();
        currentPin = config.pin || "1234";
        masterKey = config.masterKey || "1234";

        // 2. Fetch Inventory Items
        const itemsRes = await fetch(`${API_URL}/items`);
        vaultData = await itemsRes.json();

        // 3. Fetch Audit Logs
        const logsRes = await fetch(`${API_URL}/logs`);
        auditLogs = await logsRes.json();

    } catch (error) {
        console.error("⚠️ Make sure your Node backend is running!", error);
    }
}

// Run this immediately when the page loads
window.onload = initApp;

// --- 3DES ENGINE ---
function xorStrings(t, k) {
    let r = '';
    for (let i = 0; i < t.length; i++) {
        r += String.fromCharCode((t.charCodeAt(i) ^ k.charCodeAt(i % k.length)) % 256);
    }
    return r;
}

function runFeistel16(block, key) {
    let padded = block.padEnd(8, ' ').substring(0, 8);
    let L = padded.substring(0, 4), R = padded.substring(4, 8);
    for (let i = 0; i < 16; i++) {
        let temp = R;
        R = xorStrings(L, xorStrings(R, key));
        L = temp;
    }
    return R + L;
}

function apply3DES(text) {
    let s1 = runFeistel16(text, masterKey);
    let s2 = runFeistel16(s1, masterKey.split('').reverse().join(''));
    let s3 = runFeistel16(s2, masterKey);
    return "3DES-" + btoa(s3);
}

function decrypt3DES(enc) {
    try {
        let raw = atob(enc.replace("3DES-", ""));
        let st1 = runFeistel16(raw, masterKey);
        let st2 = runFeistel16(st1, masterKey.split('').reverse().join(''));
        let st3 = runFeistel16(st2, masterKey);
        return st3.trim();
    } catch (e) { return "Error"; }
}

// --- LOGGING TO DATABASE ---
function renderAuditLogs() {
    const logDiv = document.getElementById('audit-list');
    if (logDiv) {
        if (auditLogs.length > 0) {
            logDiv.innerHTML = auditLogs.map(log => {
                let color = '#ef4444';
                if (log.status === 'SUCCESS') color = '#10b981';
                if (log.status === 'DELETED') color = '#dc2626';
                return `[${log.timestamp}] <span style="color:${color}; font-weight:normal;">${log.status}</span>: ${log.action}`;
            }).join('<br>');
        } else {
            logDiv.innerHTML = '<div style="color: #64748b;"> Initializing Secure Environment </div>';
        }
    }
}

async function addLog(action, status) {
    const timestamp = new Date().toLocaleString(); 
    const newLog = { action, status, timestamp };

    // Send to Backend
    try {
        const res = await fetch(`${API_URL}/logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newLog)
        });
        const savedLog = await res.json();
        
        // Update Frontend
        auditLogs.unshift(savedLog);
        renderAuditLogs();
    } catch(err) { console.error(err); }
}

// --- ACCESS CONTROL ---
function checkLogin() {
    const entered = document.getElementById('pin-input').value;
    if (entered === currentPin) {
        currentUserRole = 'admin';
        addLog("Admin Dashboard Accessed", "SUCCESS");
        setupUI();
    } else {
        addLog(`Failed Admin Entry (PIN: ${entered})`, "FAILED");
        document.getElementById('security-alert').classList.remove('hidden');
    }
}

function checkStudentLogin() {
    const n = document.getElementById('student-name').value.trim();
    const sid = document.getElementById('student-id').value.trim();
    if (n && sid) {
        currentUserRole = 'student';
        currentStudent = { name: n, id: sid };
        addLog(`Student Login: ${n} (ID: ${sid})`, "SUCCESS");
        setupUI();
    } else {
        alert("Please enter both Name and Student ID.");
    }
}

function setupUI() {
    document.getElementById('login-container').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
   
    const isAdmin = (currentUserRole === 'admin');
    document.getElementById('admin-controls').classList.toggle('hidden', !isAdmin);
    document.getElementById('audit-log-container').classList.toggle('hidden', !isAdmin);
    document.getElementById('admin-hint').classList.toggle('hidden', !isAdmin);
    document.getElementById('btn-update-pin').classList.toggle('hidden', !isAdmin);
    document.getElementById('btn-update-master').classList.toggle('hidden', !isAdmin);
    document.getElementById('btn-filter-borrowed').classList.toggle('hidden', !isAdmin);
   
    document.getElementById('user-greeting').innerHTML = isAdmin 
        ? "Admin Dashboard" 
        : `Student: <span style="color: #10b981;">${currentStudent.name}</span> ID: <span style="color: #10b981;">${currentStudent.id}</span>`;
        
    if (isAdmin) renderAuditLogs();
    updateTable();
}

// --- TABLE RENDERING ---
function updateTable(dataToDisplay = vaultData) {
    const thead = document.querySelector('#vault-table thead');
    const list = document.getElementById('inventory-list');
    const isAdmin = (currentUserRole === 'admin');

    thead.innerHTML = isAdmin ?
        `<tr><th>#</th><th>Equipment</th><th>Encrypted Serial (3DES)</th><th>Status</th><th>Action</th></tr>` :
        `<tr><th>#</th><th>Equipment</th><th>Status</th><th>Action</th></tr>`;

    list.innerHTML = "";
    dataToDisplay.forEach((item, index) => {
        let row = `<tr><td>${index+1}</td><td><strong>${item.equipment}</strong></td>`;
       
        let penaltyText = "";
        if (item.status === 'Borrowed' && item.returnDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0); 
            const returnD = new Date(item.returnDate + "T00:00:00"); 
            const diffDays = Math.ceil((today - returnD) / (1000 * 60 * 60 * 24));

            if (diffDays > 0) {
                const totalPenalty = diffDays * 50; 
                penaltyText = `<br><span style="color: #ef4444; font-size: 0.75rem;"> Overdue: ₱${totalPenalty}</span>`;
            } else {
                penaltyText = `<br><small style="color: #64748b;">Due: ${item.returnDate}</small>`;
            }
        }

        if (isAdmin) {
            let statusBadge = `<span class="badge ${item.status==='Available'?'badge-available':'badge-borrowed'}">${item.status}</span>`;
            if(item.status === 'Borrowed') {
                statusBadge += `<br><small>By: ${item.borrower}</small>`;
                statusBadge += penaltyText; 
            }
           
            let displaySerial = item.serials.length > 1 ? `[${item.serials.length} Serials Hidden]` : item.serials[0];

            // Uses item._id from MongoDB
            row += `<td style="cursor:pointer; font-family:monospace; color:#64748b;" onclick="unlockItem('${item._id}')">${displaySerial}</td>
                    <td>${statusBadge}</td>
                    <td><button onclick="removeItem('${item._id}')" class="btn-delete-row">Delete</button></td>`;
        } else {
            let btn = item.status === 'Available' ? `<button onclick="borrowItem('${item._id}')" class="btn-borrow">Borrow</button>` :
                     (item.borrower === currentStudent.name ? `<button onclick="returnItem('${item._id}')" class="btn-return">Return</button>` : 'Unavailable');
            
            let studentStatusBadge = `<span class="badge ${item.status==='Available'?'badge-available':'badge-borrowed'}">${item.status}</span>`;
            if(item.status === 'Borrowed') studentStatusBadge += penaltyText;

            row += `<td>${studentStatusBadge}</td>
                    <td>${btn}</td>`;
        }
        list.innerHTML += row + "</tr>";
    });
}

// --- DATABASE ACTIONS ---
async function addNewItem() {
    const n = document.getElementById('item-name').value.trim();
    const s = document.getElementById('item-serial').value.trim();

    if (n && s) {
        let serialList = s.split(',').map(str => str.trim()).filter(Boolean);
        const encryptedSerials = serialList.map(serial => apply3DES(serial));

        const newItem = { 
            equipment: n, 
            serials: encryptedSerials, 
            status: 'Available', 
            borrower: '',
            returnDate: ''
        };

        try {
            // POST to backend
            const res = await fetch(`${API_URL}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newItem)
            });
            const savedItem = await res.json();
            
            vaultData.push(savedItem); // Add DB version with _id
            addLog(`Registered: ${n}`, "SUCCESS");
            updateTable();

            document.getElementById('item-name').value = ""; 
            document.getElementById('item-serial').value = "";
        } catch(err) { console.error(err); alert("Error saving to database."); }
    } else {
        alert("Please enter both the item name and serial number.");
    }
}

function unlockItem(id) {
    const key = prompt("MASTER KEY REQUIRED:");
    const item = vaultData.find(i => i._id === id);

    if (key === masterKey) {
        addLog(`Decrypted serials for ${item.equipment}`, "SUCCESS");
        const decrypted = item.serials.map(enc => decrypt3DES(enc)).join('\n');
        alert(`🔓 Serial(s):\n${decrypted}`);
    } else if (key !== null) {
        addLog(`Invalid Decryption Attempt`, "FAILED");
        alert("Incorrect Master Key.");
    }
}

function borrowItem(id) { 
    pendingBorrowId = id; 
    document.getElementById('borrow-modal').classList.remove('hidden'); 
}

async function confirmBorrow() {
    const date = document.getElementById('return-date-field').value;
    let item = vaultData.find(i => i._id === pendingBorrowId);
    
    if(date) {
        item.status = 'Borrowed';
        item.borrower = currentStudent.name;
        item.returnDate = date; 
        
        try {
            // PUT update to backend
            await fetch(`${API_URL}/items/${item._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });

            addLog(`Borrowed by ${currentStudent.name}: ${item.equipment}`, "SUCCESS");
            updateTable(); 
            closeBorrowModal();
        } catch(err) { console.error(err); }
    } else {
        alert("Please select a return date.");
    }
}

async function returnItem(id) { 
    let item = vaultData.find(i => i._id === id);

    if (item.returnDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const returnD = new Date(item.returnDate + "T00:00:00");
        const diffDays = Math.ceil((today - returnD) / (1000 * 60 * 60 * 24));

        if (diffDays > 0) {
            const totalPenalty = diffDays * 50;
            alert(` OVERDUE ITEM DETECTED!\n\nPlease proceed to the Administrator to pay the penalty fee of ₱${totalPenalty}.`);
        }
    }

    addLog(`Returned by ${item.borrower}: ${item.equipment}`, "SUCCESS");

    item.status = 'Available'; 
    item.borrower = ''; 
    item.returnDate = ''; 
    
    try {
        await fetch(`${API_URL}/items/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
        });
        updateTable(); 
    } catch(err) { console.error(err); }
}

async function removeItem(id) { 
    if(confirm("Delete item?")) { 
        const item = vaultData.find(i => i._id === id);
        addLog(`Item Deleted: ${item.equipment}`, "DELETED"); 
        
        // DELETE from backend
        try {
            await fetch(`${API_URL}/items/${id}`, { method: 'DELETE' });
            vaultData = vaultData.filter(i => i._id !== id); 
            updateTable();
        } catch(err) { console.error(err); }
    } 
}

function filterByStatus(s) { 
    updateTable(s === 'All' ? vaultData : vaultData.filter(i => i.status === s)); 
}

// --- CONFIG ACTIONS ---
async function saveNewPin() { 
    const oldPin = document.getElementById('old-pin-field').value;
    const newPin = document.getElementById('new-pin-field').value; 
    
    if (!oldPin || !newPin) {
        alert("Please fill in both fields.");
        return;
    }

    if (oldPin === currentPin) { 
        currentPin = newPin; 
        
        // Save to Backend
        await fetch(`${API_URL}/config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: currentPin, masterKey: masterKey })
        });

        addLog("PIN Changed", "SUCCESS"); 
        alert("PIN successfully updated!"); 
        closePinModal(); 
    } else {
        addLog("Failed PIN Update", "FAILED");
        alert("Incorrect Old PIN.");
    }
}

async function saveMasterKey() {
    const oldKey = document.getElementById('old-master-key-field').value;
    const newKey = document.getElementById('new-master-key-field').value;
    
    if (!oldKey || !newKey) {
        alert("Please fill in both fields.");
        return;
    }
    
    if (oldKey === masterKey) {
        masterKey = newKey;
        
        await fetch(`${API_URL}/config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: currentPin, masterKey: masterKey })
        });

        addLog("Master Key Changed", "SUCCESS");
        alert("Master Key successfully updated! Old items still require the old key.");
        closeMasterKeyModal();
    } else {
        addLog("Failed Master Key Update", "FAILED");
        alert("Incorrect Old Master Key.");
    }
}

// --- UTILS & UI CONTROLS ---
function lockSystem() { location.reload(); }

function switchTab(role) {
    const isAdmin = (role === 'admin');
    document.getElementById('admin-login-form').classList.toggle('hidden', !isAdmin);
    document.getElementById('student-login-form').classList.toggle('hidden', isAdmin);
    document.getElementById('tab-admin').classList.toggle('active', isAdmin);
    document.getElementById('tab-student').classList.toggle('active', !isAdmin);
    document.getElementById('pin-input').value = "";
    document.getElementById('student-name').value = "";
    document.getElementById('student-id').value = "";
}

function closeAlert() { document.getElementById('security-alert').classList.add('hidden'); }
function openPinModal() { document.getElementById('pin-modal').classList.remove('hidden'); }
function closePinModal() { 
    document.getElementById('pin-modal').classList.add('hidden'); 
    document.getElementById('old-pin-field').value = '';
    document.getElementById('new-pin-field').value = '';
}
function openMasterKeyModal() { document.getElementById('master-key-modal').classList.remove('hidden'); }
function closeMasterKeyModal() { 
    document.getElementById('master-key-modal').classList.add('hidden'); 
    document.getElementById('old-master-key-field').value = '';
    document.getElementById('new-master-key-field').value = '';
}
function closeBorrowModal() { document.getElementById('borrow-modal').classList.add('hidden'); }
function handleLoginEnter(e) { if(e.key === 'Enter') checkLogin(); }
function handleAddItemEnter(e) { if(e.key === 'Enter') addNewItem(); }
function handleUpdatePinEnter(e) { if(e.key === 'Enter') { e.preventDefault(); saveNewPin(); } }