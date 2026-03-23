let currentPin = "1234";
let vaultData = [];

// Track who is currently logged in
let currentUserRole = null; // 'admin' or 'student'
let currentStudent = { name: '', id: '' };

// ==========================================
// 16-ROUND FEISTEL CIPHER LOGIC (DES SIMULATION)
// ==========================================
// Core Concept: The Feistel network is a symmetric structure used in the construction 
// of block ciphers like DES. Its primary advantage is that encryption and decryption 
// operations are identical, requiring only a reversal of the key schedule.

/**
 * Performs a bitwise XOR (Exclusive OR) operation between text and a key.
 * In cryptography, XOR is fundamental because it is easily reversible: (A XOR B) XOR B = A.
 */
function xorStrings(textStr, keyStr) {
    let result = '';
    for (let i = 0; i < textStr.length; i++) {
        // Convert characters to their ASCII integer values
        let textChar = textStr.charCodeAt(i) || 0;
        let keyChar = keyStr.charCodeAt(i % keyStr.length) || 0;
        
        // XOR the text byte with the key byte
        result += String.fromCharCode((textChar ^ keyChar) % 256);
    }
    return result;
}

/**
 * Simulates the 16 rounds of processing found in the standard Data Encryption Standard (DES).
 * * Key Mechanics to Note:
 * 1. Block Splitting: The input is split into two halves (Left and Right).
 * 2. The Round Function (f): The Right half is mangled using the Key (via XOR).
 * 3. Swapping: The Left and Right halves are swapped for the next round.
 */
function runFeistel16(textBlock, key) {
    // Pad or truncate the input to simulate a fixed 8-character (64-bit) block size
    let paddedText = textBlock.padEnd(8, ' ').substring(0, 8);
    
    // Split the block into Left (L) and Right (R) halves
    let L = paddedText.substring(0, 4);
    let R = paddedText.substring(4, 8);

    // Execute 16 identical rounds of substitution and permutation
    for (let round = 1; round <= 16; round++) {
        let nextL = R; // The old Right half becomes the new Left half
        
        // The Round Function (f): XOR the Right half with the Key
        let fResult = xorStrings(R, key); 
        
        // XOR the result of the function with the old Left half to create the new Right half
        let nextR = xorStrings(L, fResult); 
        
        L = nextL;
        R = nextR;
    }

    // After 16 rounds, the final output is recombined (with a final swap of R and L)
    return R + L; 
}

// ==========================================
// TRIPLE DES (3DES) IMPLEMENTATION
// ==========================================

/**
 * Applies the 3DES Encrypt-Decrypt-Encrypt (E-D-E) sequence.
 * * Cryptographic Protocol:
 * To maximize security and maintain backward compatibility with standard DES, 
 * 3DES processes each block three times.
 * * Stage 1: Encrypt with Key 1 (Here, the current Admin PIN)
 * Stage 2: Decrypt with Key 2 (Here, the reversed Admin PIN to simulate a separate key)
 * Stage 3: Encrypt with Key 3 (Here, reusing Key 1, mimicking a 2-key 3DES setup)
 */
function apply3DES(text) {
    // Stage 1: Standard Feistel Encryption
    let stage1 = runFeistel16(text, currentPin); 
    
    // Stage 2: Feistel "Decryption" using Key 2 (Reversed PIN)
    let stage2 = runFeistel16(stage1, currentPin.split('').reverse().join('')); 
    
    // Stage 3: Final Feistel Encryption using Key 1
    let stage3 = runFeistel16(stage2, currentPin); 

    // Encode the final cipher text in Base64 so it can be safely displayed in the HTML table
    return "3DES-" + btoa(stage3);
}

/**
 * Reverses the 3DES sequence using a Decrypt-Encrypt-Decrypt (D-E-D) flow.
 * Because the Feistel network is symmetric, we run the exact same `runFeistel16` 
 * function but apply the key stages in reverse order.
 */
function decrypt3DES(encryptedString) {
    try {
        // Strip the identifier prefix and decode from Base64 back to raw cipher text
        let rawData = atob(encryptedString.replace("3DES-", ""));
        
        // Reverse Stage 3: Decrypt with Key 1
        let step1 = runFeistel16(rawData, currentPin); 
        
        // Reverse Stage 2: Encrypt with Key 2 (Reversed PIN)
        let step2 = runFeistel16(step1, currentPin.split('').reverse().join('')); 
        
        // Reverse Stage 1: Decrypt with Key 1
        let step3 = runFeistel16(step2, currentPin); 
        
        // Remove the padding spaces added during the initial block splitting
        return step3.trim(); 
    } catch (e) {
        return "Decryption Error";
    }
}

// Triggered when the Admin clicks an encrypted value in the table to verify reversibility
function showDecryption(index) {
    const item = vaultData[index];
    const originalSerial = decrypt3DES(item.encrypted);
    alert(`🔐 DECRYPTION SUCCESSFUL!\n\nEquipment: ${item.equipment}\nEncrypted Value: ${item.encrypted}\n\n🔓 Extracted Serial: ${originalSerial}`);
}

// ==========================================
// ACCESS CONTROL & TABS (RBAC)
// ==========================================
// Handles the switching between Admin and Student login panels
function switchTab(role) {
    if (role === 'admin') {
        document.getElementById('admin-login-form').classList.remove('hidden');
        document.getElementById('student-login-form').classList.add('hidden');
        document.getElementById('tab-admin').classList.add('active');
        document.getElementById('tab-student').classList.remove('active');
    } else {
        document.getElementById('admin-login-form').classList.add('hidden');
        document.getElementById('student-login-form').classList.remove('hidden');
        document.getElementById('tab-admin').classList.remove('active');
        document.getElementById('tab-student').classList.add('active');
    }
}

function handleLoginEnter(event) {
    if (event.key === "Enter") {
        const alertOverlay = document.getElementById('security-alert');
        if (alertOverlay && alertOverlay.classList.contains('hidden')) {
            event.preventDefault();
            checkLogin();
        }
    }
}

// Verifies Admin PIN against the stored cryptographic key
function checkLogin() {
    const entered = document.getElementById('pin-input').value;
    if (entered === currentPin) {
        currentUserRole = 'admin';
        document.getElementById('login-container').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        document.getElementById('pin-input').value = ""; 
        setupDashboardUI();
        updateTable();
    } else {
        document.getElementById('security-alert').classList.remove('hidden');
    }
}

// Authenticates student credentials
function checkStudentLogin() {
    const name = document.getElementById('student-name').value.trim();
    const sid = document.getElementById('student-id').value.trim();
    
    if (name && sid) {
        currentUserRole = 'student';
        currentStudent = { name: name, id: sid };
        
        document.getElementById('login-container').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        setupDashboardUI();
        updateTable();
    } else {
        alert("Please enter both your Name and Student ID.");
    }
}

// Conditionally renders UI elements based on the current user's authorization level
function setupDashboardUI() {
    const adminControls = document.getElementById('admin-controls');
    const updatePinBtn = document.getElementById('btn-update-pin');
    const greetingBox = document.getElementById('user-greeting'); 

    if (currentUserRole === 'admin') {
        adminControls.classList.remove('hidden');
        updatePinBtn.classList.remove('hidden');
        
        // Admin greeting
        greetingBox.innerHTML = `Logged in as: <strong style="color: #f39c12;">Administrator</strong>`;
    } else {
        // Obscure administrative tools from student view
        adminControls.classList.add('hidden');
        updatePinBtn.classList.add('hidden');
        
        // Student greeting 
        greetingBox.innerHTML = `Welcome, <strong style="color: #10b981;">${currentStudent.name}</strong> | ID: ${currentStudent.id}`;
    }
}

function closeAlert() { 
    document.getElementById('security-alert').classList.add('hidden'); 
    const pinField = document.getElementById('pin-input');
    if (pinField) { pinField.value = ""; pinField.focus(); }
}

function lockSystem() { 
    document.getElementById('dashboard').classList.add('hidden'); 
    document.getElementById('login-container').classList.remove('hidden'); 
    
    // Clear Session Data to prevent unauthorized access
    currentUserRole = null;
    currentStudent = { name: '', id: '' };
    document.getElementById('student-name').value = "";
    document.getElementById('student-id').value = "";
    document.getElementById('user-greeting').innerHTML = ""; 
}

// ==========================================
// PIN MODAL LOGIC (KEY MANAGEMENT)
// ==========================================
function openPinModal() { document.getElementById('pin-modal').classList.remove('hidden'); }
function closePinModal() { document.getElementById('pin-modal').classList.add('hidden'); document.getElementById('new-pin-field').value = ""; }

function handleUpdatePinEnter(event) {
    if (event.key === "Enter") { event.preventDefault(); saveNewPin(); }
}

// Updates the primary encryption key
function saveNewPin() {
    const newPin = document.getElementById('new-pin-field').value;
    if (newPin) { 
        currentPin = newPin; 
        alert("PIN Updated! Note: Old items were encrypted with the old PIN."); 
        closePinModal(); 
    } else { alert("Field cannot be empty."); }
}

// ==========================================
// INVENTORY & BORROWING LOGIC
// ==========================================
function handleAddItemEnter(event) {
    if (event.key === "Enter") { event.preventDefault(); addNewItem(); }
}

// Captures input, applies 3DES encryption to the serial, and stores the record
function addNewItem() {
    const name = document.getElementById('item-name').value;
    const serial = document.getElementById('item-serial').value;
    if (name && serial) {
        vaultData.push({ 
            equipment: name, 
            serial: serial, 
            encrypted: apply3DES(serial), // Run the serial through the cipher sequence
            status: 'Available',    
            borrower: ''            
        });
        document.getElementById('item-name').value = "";
        document.getElementById('item-serial').value = "";
        updateTable();
    } else { alert("Please fill in both fields."); }
}

function removeItem(i) {
    vaultData.splice(i, 1);
    updateTable();
}

function borrowItem(index) {
    vaultData[index].status = 'Borrowed';
    vaultData[index].borrower = currentStudent.name;
    updateTable();
}

function returnItem(index) {
    vaultData[index].status = 'Available';
    vaultData[index].borrower = '';
    updateTable();
}

// ==========================================
// SEARCH LOGIC & DOM RENDERING
// ==========================================
function handleSearch(event) {
    if (event.key === "Enter") {
        if (event.preventDefault) event.preventDefault();
        const query = document.getElementById('search-input').value.toLowerCase().trim();
        const filteredResults = vaultData.filter(item => 
            item.equipment.toLowerCase().includes(query)
        );
        updateTable(filteredResults);
    }
}

// Dynamically builds the data table, hiding encrypted values if the user is a student
function updateTable(dataToDisplay = vaultData) {
    const thead = document.querySelector('#vault-table thead');
    const list = document.getElementById('inventory-list');
    
    // 1. Render Dynamic Headers based on Role
    if (currentUserRole === 'admin') {
        thead.innerHTML = `
            <tr>
                <th style="width: 40px;">#</th>
                <th>Equipment Name</th>
                <th>Serial Number</th>
                <th>3DES Encrypted Value</th>
                <th>Status</th>
                <th>Action</th>
            </tr>`;
    } else {
        thead.innerHTML = `
            <tr>
                <th style="width: 40px;">#</th>
                <th>Equipment Name</th>
                <th>Status</th>
                <th>Action</th>
            </tr>`;
    }

    list.innerHTML = "";
    
    // 2. Render Rows based on Role
    dataToDisplay.forEach((item, index) => {
        const masterIndex = vaultData.indexOf(item);
        let rowHTML = `<tr><td style="font-weight: bold; color: #003366;">${index + 1}</td>`;

        if (currentUserRole === 'admin') {
            // ADMIN VIEW: Full visibility including cleartext and ciphertext
            rowHTML += `
                <td><strong>${item.equipment}</strong></td>
                <td style="color: #10b981; font-weight: bold;">${item.serial}</td>
                <td style="font-family: monospace; color: #64748b; font-weight: bold; cursor: pointer;" 
                    onclick="showDecryption(${masterIndex})" title="Click here to test Decryption!">
                    ${item.encrypted}
                </td>
                <td>
                    <span class="badge ${item.status === 'Available' ? 'badge-available' : 'badge-borrowed'}">
                        ${item.status} ${item.status === 'Borrowed' ? '(' + item.borrower + ')' : ''}
                    </span>
                </td>
                <td><button onclick="removeItem(${masterIndex})" class="btn-delete-row">Delete</button></td>
            `;
        } else {
            // STUDENT VIEW: Ciphertext and cleartext serials are hidden
            let actionBtn = "";
            if (item.status === 'Available') {
                actionBtn = `<button onclick="borrowItem(${masterIndex})" class="btn-borrow">Borrow</button>`;
            } else if (item.status === 'Borrowed' && item.borrower === currentStudent.name) {
                actionBtn = `<button onclick="returnItem(${masterIndex})" class="btn-return">Return Item</button>`;
            } else {
                actionBtn = `<span style="color: #ef4444; font-size: 0.8rem; font-weight: bold;">Unavailable</span>`;
            }

            rowHTML += `
                <td><strong>${item.equipment}</strong></td>
                <td>
                    <span class="badge ${item.status === 'Available' ? 'badge-available' : 'badge-borrowed'}">
                        ${item.status}
                    </span>
                </td>
                <td>${actionBtn}</td>
            `;
        }

        rowHTML += `</tr>`;
        list.innerHTML += rowHTML;
    });

    if (dataToDisplay.length === 0) {
        const colSpan = currentUserRole === 'admin' ? 6 : 4;
        list.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center; padding:20px; color:#94a3b8;">No records found.</td></tr>`;
    }
}

// ==========================================
// GLOBAL EVENT LISTENER FOR ALERTS
// ==========================================
document.addEventListener('keydown', function(event) {
    const alertOverlay = document.getElementById('security-alert');
    if (event.key === "Enter" && alertOverlay && !alertOverlay.classList.contains('hidden')) {
        event.preventDefault(); 
        closeAlert(); 
    }
});