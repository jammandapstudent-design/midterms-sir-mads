// --- STATE ---
let currentPin = localStorage.getItem('cit_vault_pin') || "1234";
let vaultData = JSON.parse(localStorage.getItem('cit_vault_data')) || [];
let auditLogs = [];
let currentUserRole = null;
let currentStudent = { name: '', id: '' };
let pendingBorrowIndex = -1;

// --- 3DES ENGINE (16-Round Feistel Cipher) ---
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
    let s1 = runFeistel16(text, currentPin); 
    let s2 = runFeistel16(s1, currentPin.split('').reverse().join('')); 
    let s3 = runFeistel16(s2, currentPin); 
    return "3DES-" + btoa(s3);
}

function decrypt3DES(enc) {
    try {
        let raw = atob(enc.replace("3DES-", ""));
        let st1 = runFeistel16(raw, currentPin); 
        let st2 = runFeistel16(st1, currentPin.split('').reverse().join('')); 
        let st3 = runFeistel16(st2, currentPin); 
        return st3.trim();
    } catch (e) { return "Error"; }
}

// --- LOGGING ---
function addLog(action, status) {
    const timestamp = new Date().toLocaleTimeString();
    let color = '#ef4444'; 
    if (status === 'SUCCESS') color = '#10b981'; 
    if (status === 'DELETED') color = '#dc2626'; 

    const logEntry = `[${timestamp}] <span style="color:${color}; font-weight:bold;">${status}</span>: ${action}`;
    auditLogs.unshift(logEntry); 
    const logDiv = document.getElementById('audit-list');
    if (logDiv) logDiv.innerHTML = auditLogs.join('<br>');
}

// --- ACCESS CONTROL ---
function checkLogin() {
    const entered = document.getElementById('pin-input').value;
    if (entered === currentPin) {
        currentUserRole = 'admin';
        addLog("Administrator Login", "SUCCESS");
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
    document.getElementById('btn-filter-borrowed').classList.toggle('hidden', !isAdmin);
    
    document.getElementById('user-greeting').innerHTML = isAdmin ? "Admin Dashboard" : `Student: ${currentStudent.name}`;
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
        const mIdx = vaultData.indexOf(item);
        let row = `<tr><td>${index+1}</td><td><strong>${item.equipment}</strong></td>`;
        
        if (isAdmin) {
            let statusBadge = `<span class="badge ${item.status==='Available'?'badge-available':'badge-borrowed'}">${item.status}</span>`;
            
            // Display only borrower and return date
            if(item.status === 'Borrowed') {
                statusBadge += `
                    <div style="margin-top: 8px; font-size: 0.75rem; color: #475569; line-height: 1.5;">
                        <strong>By:</strong> ${item.borrower}<br>
                        <strong>Return:</strong> <span style="color: #ef4444;">${item.returnDate}</span>
                    </div>`;
            }
            
            row += `<td style="cursor:pointer; font-family:monospace; color:#64748b;" onclick="unlockItem(${mIdx})">${item.encrypted}</td>
                    <td>${statusBadge}</td>
                    <td><button onclick="removeItem(${mIdx})" class="btn-delete-row">Delete</button></td>`;
        } else {
            let btn = item.status === 'Available' ? `<button onclick="borrowItem(${mIdx})" class="btn-borrow">Borrow</button>` : 
                     (item.borrower === currentStudent.name ? `<button onclick="returnItem(${mIdx})" class="btn-return">Return</button>` : 'Unavailable');
            row += `<td><span class="badge ${item.status==='Available'?'badge-available':'badge-borrowed'}">${item.status}</span></td>
                    <td>${btn}</td>`;
        }
        list.innerHTML += row + "</tr>";
    });

    if (dataToDisplay.length === 0) {
        const colCount = isAdmin ? 5 : 4;
        list.innerHTML = `<tr><td colspan="${colCount}" style="text-align:center; padding:20px; color:#94a3b8;">No records found.</td></tr>`;
    }
}

// --- ACTIONS ---
function addNewItem() {
    const n = document.getElementById('item-name').value;
    const s = document.getElementById('item-serial').value;
    if (n && s) {
        vaultData.push({ 
            equipment: n, 
            encrypted: apply3DES(s), 
            status: 'Available', 
            borrower: '',
            returnDate: ''
        });
        addLog(`Registered: ${n}`, "SUCCESS");
        saveData();
        document.getElementById('item-name').value = ""; document.getElementById('item-serial').value = "";
    } else {
        alert("Please fill in both fields.");
    }
}

function unlockItem(i) {
    const key = prompt("MASTER KEY REQUIRED to decrypt 3DES Value:");
    if (key === currentPin) {
        addLog(`Decrypted serial for ${vaultData[i].equipment}`, "SUCCESS");
        alert(`🔓 Extracted Serial: ${decrypt3DES(vaultData[i].encrypted)}`);
    } else if (key !== null) {
        addLog(`Invalid Decryption Attempt on ${vaultData[i].equipment}`, "FAILED");
        alert("Incorrect PIN. Access Denied.");
    }
}

function borrowItem(i) { 
    pendingBorrowIndex = i; 
    document.getElementById('borrow-modal').classList.remove('hidden'); 
}

function confirmBorrow() {
    const rDate = document.getElementById('return-date-field').value;
    
    // Check if Return Date is selected
    if(rDate) {
        vaultData[pendingBorrowIndex].status = 'Borrowed';
        vaultData[pendingBorrowIndex].borrower = currentStudent.name;
        vaultData[pendingBorrowIndex].returnDate = rDate; // Save only the return date
        
        saveData(); 
        closeBorrowModal();
    } else {
        alert("⚠️ Please select the expected return date.");
    }
}

function returnItem(i) { 
    vaultData[i].status = 'Available'; 
    vaultData[i].borrower = ''; 
    vaultData[i].returnDate = ''; 
    saveData(); 
}

function removeItem(i) { 
    if(confirm("Are you sure you want to permanently delete this item?")) { 
        const deletedItemName = vaultData[i].equipment;
        vaultData.splice(i, 1); 
        addLog(`Permanently deleted: ${deletedItemName}`, "DELETED");
        saveData(); 
    } 
}

function saveData() { 
    localStorage.setItem('cit_vault_data', JSON.stringify(vaultData)); 
    updateTable(); 
}

function filterByStatus(s) { 
    updateTable(s === 'All' ? vaultData : vaultData.filter(i => i.status === s)); 
}

function saveNewPin() { 
    const p = document.getElementById('new-pin-field').value; 
    
    if(p) { 
        currentPin = p; 
        localStorage.setItem('cit_vault_pin', p); 
        addLog("Master PIN Changed", "SUCCESS"); 
        alert("✅ PIN successfully updated!"); 
        closePinModal(); 
    } else {
        alert("⚠️ Please enter a new PIN.");
    }
}

function lockSystem() { location.reload(); } 

// --- TAB SWITCHING LOGIC ---
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

// --- MODAL & EVENT HELPERS ---
function closeAlert() { document.getElementById('security-alert').classList.add('hidden'); }
function openPinModal() { document.getElementById('pin-modal').classList.remove('hidden'); }
function closePinModal() { document.getElementById('pin-modal').classList.add('hidden'); }
function closeBorrowModal() { 
    document.getElementById('borrow-modal').classList.add('hidden'); 
    
    // Clear only the return date field
    document.getElementById('return-date-field').value = '';
}

// --- KEYBOARD SHORTCUT HELPERS ---
function handleLoginEnter(e) { if(e.key === 'Enter') checkLogin(); }
function handleAddItemEnter(e) { if(e.key === 'Enter') addNewItem(); }
function handleUpdatePinEnter(e) {
    if (e.key === "Enter") {
        e.preventDefault();
        saveNewPin();
    }
}