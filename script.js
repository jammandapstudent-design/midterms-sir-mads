let currentPin = "1234";
let vaultData = [];

// Triple DES Simulation
function tripleDesSim(text) {
    let e1 = btoa(text); 
    let d2 = e1.split('').reverse().join(''); 
    let e3 = btoa(d2).substring(0, 14).toUpperCase(); 
    return "3DES-" + e3;
}

// ==========================================
// ACCESS CONTROL
// ==========================================
function handleLoginEnter(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        checkLogin();
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

function closeAlert() { document.getElementById('security-alert').classList.add('hidden'); }
function lockSystem() { 
    document.getElementById('dashboard').classList.add('hidden'); 
    document.getElementById('login-container').classList.remove('hidden'); 
}

// ==========================================
// PIN MODAL LOGIC (ENTER KEY ADDED)
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
        alert("PIN Updated Successfully!"); 
        closePinModal(); 
    } else {
        alert("Field cannot be empty.");
    }
}

// ==========================================
// INVENTORY LOGIC (ENTER KEY ADDED)
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
        vaultData.push({ equipment: name, encrypted: tripleDesSim(serial), decrypted: serial });
        document.getElementById('item-name').value = "";
        document.getElementById('item-serial').value = "";
        updateTable();
    } else {
        alert("Please fill in both fields.");
    }
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
    
    dataToDisplay.forEach((item) => {
        const masterIndex = vaultData.indexOf(item);
        list.innerHTML += `
            <tr>
                <td><strong>${item.equipment}</strong></td>
                <td style="font-family: monospace; color: #64748b;">${item.encrypted}</td>
                <td style="color: #10b981; font-weight: bold;">${item.decrypted}</td>
                <td><button onclick="removeItem(${masterIndex})" class="btn-delete-row">Delete</button></td>
            </tr>`;
    });

    if (dataToDisplay.length === 0) {
        list.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#94a3b8;">No records found.</td></tr>`;
    }
}