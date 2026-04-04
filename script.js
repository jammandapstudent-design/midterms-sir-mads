const API_URL = 'http://localhost:5000/api';

// --- STATE ---
let currentPin = "1234";
let masterKey = "1234";
let vaultData = [];
let auditLogs = [];
let currentUserRole = null;
let currentStudent = { name: '', id: '' };
let pendingBorrowId = null;
let itemToUnlockId = null;

// --- INITIALIZE FROM BACKEND ---
async function initApp() {
    try {
        const configRes = await fetch(`${API_URL}/config`);
        const config = await configRes.json();
        currentPin = config.pin || "1234";
        masterKey = config.masterKey || "1234";

        const itemsRes = await fetch(`${API_URL}/items`);
        vaultData = await itemsRes.json();

        const logsRes = await fetch(`${API_URL}/logs`);
        auditLogs = await logsRes.json();

        if (currentUserRole) setupUI(); // Refresh UI if already logged in
    } catch (error) {
        console.error("⚠️ Make sure your Node backend is running!", error);
    }
}

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

// --- VISUAL 3DES HANDLER ---
async function apply3DESWithVisuals(text) {
    const viz = document.getElementById('encryption-visualizer');
    const steps = [document.getElementById('step-1'), document.getElementById('step-2'), document.getElementById('step-3')];
    const resultBox = document.getElementById('viz-result');
    
    viz.classList.remove('hidden');
    
    // Step 1: Encrypt
    steps[0].classList.add('active');
    let s1 = runFeistel16(text, masterKey);
    resultBox.innerText = "K1 Applied: " + btoa(s1).substring(0,10) + "...";
    await new Promise(r => setTimeout(r, 800));

    // Step 2: Decrypt
    steps[1].classList.add('active');
    let s2 = runFeistel16(s1, masterKey.split('').reverse().join(''));
    resultBox.innerText = "K2 Inverse Applied: " + btoa(s2).substring(0,10) + "...";
    await new Promise(r => setTimeout(r, 800));

    // Step 3: Final Encrypt
    steps[2].classList.add('active');
    let s3 = runFeistel16(s2, masterKey);
    const finalCipher = "3DES-" + btoa(s3);
    resultBox.innerText = "Final 3DES Cipher: " + finalCipher;
    await new Promise(r => setTimeout(r, 1000));

    // Reset Visuals
    viz.classList.add('hidden');
    steps.forEach(s => s.classList.remove('active'));
    
    return finalCipher;
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

// --- LOGGING ---
async function addLog(action, status) {
    const timestamp = new Date().toLocaleString();
    const newLog = { action, status, timestamp };
    try {
        const res = await fetch(`${API_URL}/logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newLog)
        });
        const savedLog = await res.json();
        auditLogs.unshift(savedLog);
        renderAuditLogs();
    } catch(err) { console.error(err); }
}

function renderAuditLogs() {
    const logDiv = document.getElementById('audit-list');
    if (logDiv) {
        logDiv.innerHTML = auditLogs.map(log => {
            let color = log.status === 'SUCCESS' ? '#10b981' : (log.status === 'DELETED' ? '#dc2626' : '#ef4444');
            return `[${log.timestamp}] <span style="color:${color}; font-weight:bold;">${log.status}</span>: ${log.action}`;
        }).join('<br>');
    }
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
    
    // Manage Filters
    document.getElementById('btn-filter-pending').classList.toggle('hidden', !isAdmin);
    document.getElementById('btn-filter-borrowed').classList.toggle('hidden', !isAdmin);
    
    document.getElementById('user-greeting').innerHTML = isAdmin
        ? "Admin Dashboard"
        : `Student: <span style="color: #10b981;">${currentStudent.name}</span> ID: <span style="color: #10b981;">${currentStudent.id}</span>`;
    
    if (isAdmin) renderAuditLogs();
    updateTable();
}

// --- TABLE & ACTIONS ---
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
        
        // Define Badge styling
        let badgeClass = 'badge-available';
        if (item.status === 'Borrowed') badgeClass = 'badge-borrowed';
        if (item.status === 'Pending Approval') badgeClass = 'badge-pending';
        
        let penaltyText = "";
        if (item.status === 'Borrowed' && item.returnDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0); 
            const returnD = new Date(item.returnDate + "T00:00:00"); 
            const diffDays = Math.ceil((today - returnD) / (1000 * 60 * 60 * 24));
            
            if (diffDays > 0) {
                penaltyText = `<br><span style="color: #ef4444; font-size: 0.75rem;"> Overdue!</span>`;
            } else {
                penaltyText = `<br><small style="color: #64748b;">Due: ${item.returnDate}</small>`;
            }
        }
        
        let statusHtml = `<span class="badge ${badgeClass}">${item.status}</span>`;
        if(item.borrower) statusHtml += `<br><small>By: ${item.borrower}</small>`;
        if(item.status === 'Borrowed') statusHtml += penaltyText;

        if (isAdmin) {
            let displaySerial = item.serials[0];
            
            // Render Admin Actions based on Status
            let actionHtml = '';
            if (item.status === 'Pending Approval') {
                actionHtml = `
                    <button onclick="acceptRequest('${item._id}')" class="btn-action-sm" style="background:#10b981;">Accept</button>
                    <button onclick="rejectRequest('${item._id}')" class="btn-action-sm" style="background:#ef4444;">Reject</button>
                `;
            } else {
                actionHtml = `<button onclick="removeItem('${item._id}')" class="btn-delete-row">Delete</button>`;
            }

            row += `<td style="cursor:pointer; font-family:monospace; color:#3b82f6;" onclick="unlockItem('${item._id}')">${displaySerial}</td>
                    <td>${statusHtml}</td>
                    <td>${actionHtml}</td>`;
        } else {
            // Render Student Actions based on Status
            let btn = '';
            if (item.status === 'Available') {
                btn = `<button onclick="borrowItem('${item._id}')" class="btn-borrow">Borrow</button>`;
            } else if (item.status === 'Pending Approval' && item.borrower === currentStudent.name) {
                btn = `<span style="font-size: 0.8rem; color: #6366f1; font-weight: bold;">Waiting...</span>`;
            } else if (item.status === 'Borrowed' && item.borrower === currentStudent.name) {
                btn = `<button onclick="returnItem('${item._id}')" class="btn-return">Return</button>`;
            } else {
                btn = `<span style="font-size: 0.8rem; color: #64748b;">Unavailable</span>`;
            }
            
            row += `<td>${statusHtml}</td>
                    <td>${btn}</td>`;
        }
        list.innerHTML += row + "</tr>";
    });
}

// --- ADD ITEM ---
async function addNewItem() {
    const n = document.getElementById('item-name').value.trim();
    const s = document.getElementById('item-serial').value.trim();

    if (!n || !s) {
        alert("Action Denied: Item Name and Serial are required.");
        return;
    }

    const encryptedSerial = await apply3DESWithVisuals(s);

    const newItem = {
        equipment: n,
        serials: [encryptedSerial],
        status: 'Available'
    };

    try {
        const res = await fetch(`${API_URL}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newItem)
        });
        const savedItem = await res.json();
        vaultData.push(savedItem);
        addLog(`Registered: ${n} (3DES Protected)`, "SUCCESS");
        updateTable();
        document.getElementById('item-name').value = "";
        document.getElementById('item-serial').value = "";
    } catch(err) { console.error(err); }
}

// --- CUSTOM DECRYPTION PROMPT ---
function unlockItem(id) {
    itemToUnlockId = id;
    document.getElementById('master-key-prompt-modal').classList.remove('hidden');
}

function closeDecryptModal() {
    document.getElementById('master-key-prompt-modal').classList.add('hidden');
    document.getElementById('decryption-key-input').value = "";
}

function confirmDecryption() {
    const keyInput = document.getElementById('decryption-key-input').value;
    const item = vaultData.find(i => i._id === itemToUnlockId);

    if (keyInput === masterKey) {
        addLog(`Decrypted ${item.equipment}`, "SUCCESS");
        alert(`🔓 Original Serial: ${decrypt3DES(item.serials[0])}`);
        closeDecryptModal();
    } else {
        addLog("Failed Decryption Attempt", "SECURITY ALERT");
        alert("ACCESS DENIED: Invalid Master Key.");
    }
}

// --- ADMIN APPROVAL ACTIONS ---
async function acceptRequest(id) {
    let item = vaultData.find(i => i._id === id);
    item.status = 'Borrowed';
    
    try {
        await fetch(`${API_URL}/items/${item._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
        });
        addLog(`Approved request for ${item.equipment} by ${item.borrower}`, "SUCCESS");
        updateTable();
    } catch(err) { console.error(err); }
}

async function rejectRequest(id) {
    let item = vaultData.find(i => i._id === id);
    let studentName = item.borrower;
    
    item.status = 'Available';
    item.borrower = '';
    item.returnDate = '';
    
    try {
        await fetch(`${API_URL}/items/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
        });
        addLog(`Rejected request for ${item.equipment} by ${studentName}`, "DELETED");
        updateTable();
    } catch(err) { console.error(err); }
}

// --- OTHER ACTIONS ---
async function removeItem(id) {
    if(confirm("Delete item?")) {
        await fetch(`${API_URL}/items/${id}`, { method: 'DELETE' });
        vaultData = vaultData.filter(i => i._id !== id);
        updateTable();
    }
}

function borrowItem(id) {
    pendingBorrowId = id;
    document.getElementById('borrow-modal').classList.remove('hidden');
}

async function confirmBorrow() {
    const date = document.getElementById('return-date-field').value;
    if(!date) return alert("Select return date.");
    
    let item = vaultData.find(i => i._id === pendingBorrowId);
    
    item.status = 'Pending Approval';
    item.borrower = currentStudent.name;
    item.returnDate = date;

    try {
        await fetch(`${API_URL}/items/${item._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
        });
        addLog(`Requested by ${currentStudent.name}: ${item.equipment}`, "SUCCESS");
        updateTable();
        closeBorrowModal();
    } catch(err) { console.error(err); }
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

function filterByStatus(s) {
    updateTable(s === 'All' ? vaultData : vaultData.filter(i => i.status === s));
}

// --- CONFIG SETTINGS ---
async function saveNewPin() {
    const oldPin = document.getElementById('old-pin-field').value;
    const newPin = document.getElementById('new-pin-field').value;
    
    if (!oldPin || !newPin) {
        alert("Please fill in both fields.");
        return;
    }

    if (oldPin === currentPin) {
        currentPin = newPin;
        await fetch(`${API_URL}/config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: currentPin, masterKey: masterKey })
        });
        
        addLog("Security PIN Changed", "SUCCESS"); 
        alert("PIN Updated!"); 
        closePinModal();
    } else {
        addLog("Failed PIN Update Attempt", "SECURITY ALERT");
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
        alert("Master Key Updated!"); 
        closeMasterKeyModal();
    } else {
        addLog("Failed Master Key Update Attempt", "SECURITY ALERT");
        alert("Incorrect Old Master Key.");
    }
}

// --- UTILITIES ---
function lockSystem() { location.reload(); }
function switchTab(role) {
    const isAdmin = (role === 'admin');
    document.getElementById('admin-login-form').classList.toggle('hidden', !isAdmin);
    document.getElementById('student-login-form').classList.toggle('hidden', isAdmin);
    document.getElementById('tab-admin').classList.toggle('active', isAdmin);
    document.getElementById('tab-student').classList.toggle('active', !isAdmin);
}
function closeAlert() { document.getElementById('security-alert').classList.add('hidden'); }
function openPinModal() { document.getElementById('pin-modal').classList.remove('hidden'); }
function closePinModal() { document.getElementById('pin-modal').classList.add('hidden'); }
function openMasterKeyModal() { document.getElementById('master-key-modal').classList.remove('hidden'); }
function closeMasterKeyModal() { document.getElementById('master-key-modal').classList.add('hidden'); }
function closeBorrowModal() { document.getElementById('borrow-modal').classList.add('hidden'); }
function handleLoginEnter(e) { if(e.key === 'Enter') checkLogin(); }
function handleAddItemEnter(e) { if(e.key === 'Enter') addNewItem(); }
function handleUpdatePinEnter(e) { if(e.key === 'Enter') { e.preventDefault(); saveNewPin(); } }