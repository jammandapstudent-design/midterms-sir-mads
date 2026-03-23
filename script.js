let currentPin = "1234";
let vaultData = [];

// ==========================================
// 16-ROUND FEISTEL CIPHER LOGIC
// ==========================================
function xorStrings(textStr, keyStr) {
    let result = '';
    for (let i = 0; i < textStr.length; i++) {
        let textChar = textStr.charCodeAt(i) || 0;
        let keyChar = keyStr.charCodeAt(i % keyStr.length) || 0;
        result += String.fromCharCode((textChar ^ keyChar) % 256);
    }
    return result;
}

function runFeistel16(textBlock, key) {
    let paddedText = textBlock.padEnd(8, ' ').substring(0, 8);
    let L = paddedText.substring(0, 4);
    let R = paddedText.substring(4, 8);

    for (let round = 1; round <= 16; round++) {
        let nextL = R;
        let fResult = xorStrings(R, key); 
        let nextR = xorStrings(L, fResult); 
        
        L = nextL;
        R = nextR;
    }

    return R + L; 
}

// ENCRYPT: E-D-E Sequence
function apply3DES(text) {
    let stage1 = runFeistel16(text, currentPin); 
    let stage2 = runFeistel16(stage1, currentPin.split('').reverse().join('')); 
    let stage3 = runFeistel16(stage2, currentPin); 

    return "3DES-" + btoa(stage3);
}

// DECRYPT: D-E-D Sequence
function decrypt3DES(encryptedString) {
    try {
        let rawData = atob(encryptedString.replace("3DES-", ""));
        let step1 = runFeistel16(rawData, currentPin); 
        let step2 = runFeistel16(step1, currentPin.split('').reverse().join('')); 
        let step3 = runFeistel16(step2, currentPin); 
        return step3.trim(); 
    } catch (e) {
        return "Decryption Error";
    }
}

// Triggered when user clicks an encrypted value in the table
function showDecryption(index) {
    const item = vaultData[index];
    const originalSerial = decrypt3DES(item.encrypted);
    alert(`🔐 DECRYPTION SUCCESSFUL!\n\nEquipment: ${item.equipment}\nEncrypted Value: ${item.encrypted}\n\n🔓 Extracted Serial: ${originalSerial}`);
}

// ==========================================
// ACCESS CONTROL
// ==========================================
function handleLoginEnter(event) {
    if (event.key === "Enter") {
        const alertOverlay = document.getElementById('security-alert');
        if (alertOverlay && alertOverlay.classList.contains('hidden')) {
            event.preventDefault();
            checkLogin();
        }
    }
}

function checkLogin() {
    const entered = document.getElementById('pin-input').value;
    if (entered === currentPin) {
        document.getElementById('login-container').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        document.getElementById('pin-input').value = ""; 
    } else {
        document.getElementById('security-alert').classList.remove('hidden');
    }
}

function closeAlert() { 
    document.getElementById('security-alert').classList.add('hidden'); 
    const pinField = document.getElementById('pin-input');
    if (pinField) {
        pinField.value = ""; 
        pinField.focus(); 
    }
}

function lockSystem() { 
    document.getElementById('dashboard').classList.add('hidden'); 
    document.getElementById('login-container').classList.remove('hidden'); 
}

// ==========================================
// PIN MODAL LOGIC
// ==========================================
function openPinModal() { document.getElementById('pin-modal').classList.remove('hidden'); }
function closePinModal() { document.getElementById('pin-modal').classList.add('hidden'); document.getElementById('new-pin-field').value = ""; }

function handleUpdatePinEnter(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        saveNewPin();
    }
}

function saveNewPin() {
    const newPin = document.getElementById('new-pin-field').value;
    if (newPin) { 
        currentPin = newPin; 
        alert("PIN Updated! Note: Old items were encrypted with the old PIN."); 
        closePinModal(); 
    } else { alert("Field cannot be empty."); }
}

// ==========================================
// INVENTORY LOGIC
// ==========================================
function handleAddItemEnter(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        addNewItem();
    }
}

function addNewItem() {
    const name = document.getElementById('item-name').value;
    const serial = document.getElementById('item-serial').value;
    if (name && serial) {
        vaultData.push({ 
            equipment: name, 
            serial: serial, 
            encrypted: apply3DES(serial) 
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

// ==========================================
// SEARCH LOGIC
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

function updateTable(dataToDisplay = vaultData) {
    const list = document.getElementById('inventory-list');
    list.innerHTML = "";
    
    dataToDisplay.forEach((item, index) => {
        const masterIndex = vaultData.indexOf(item);
        list.innerHTML += `
            <tr>
                <td style="font-weight: bold; color: #003366;">${index + 1}</td>
                <td><strong>${item.equipment}</strong></td>
                <td style="color: #10b981; font-weight: bold;">${item.serial}</td>
                
                <td style="font-family: monospace; color: #64748b; font-weight: bold; cursor: pointer;" 
                    onclick="showDecryption(${masterIndex})" 
                    title="Click here to test Decryption!">
                    ${item.encrypted}
                </td>
                
                <td><button onclick="removeItem(${masterIndex})" class="btn-delete-row">Delete</button></td>
            </tr>`;
    });

    if (dataToDisplay.length === 0) {
        list.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#94a3b8;">No records found.</td></tr>`;
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