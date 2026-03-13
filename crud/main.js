'use strict'

const API_BASE = 'https://186.194.32.186:3000' // same origin (served by backend)

let __cacheClients = []

const openModal = () => document.getElementById('modal')
    .classList.add('active')

const closeModal = () => {
    clearFields()
    document.getElementById('modal').classList.remove('active')
}

const isValidFields = () =>{
    return document.getElementById('form').reportValidity()
}

const clearFields = () => {
    const fields = document.querySelectorAll('.modal-field')
    fields.forEach(field => field.value = "")
    document.getElementById('nome').dataset.index = 'new'
}

// ---------- API ----------
async function apiGetClients(){
    const r = await fetch(`${API_BASE}/clients`)
    if(!r.ok) throw new Error(`GET /clients falhou: ${r.status}`)
    return await r.json()
}

async function apiCreateClient(client){
    const r = await fetch(`${API_BASE}/clients`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(client)
    })
    if(!r.ok){
        const msg = await safeReadError(r)
        throw new Error(msg)
    }
    return await r.json()
}

async function apiUpdateClient(id, client){
    const r = await fetch(`${API_BASE}/clients/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(client)
    })
    if(!r.ok){
        const msg = await safeReadError(r)
        throw new Error(msg)
    }
    return await r.json()
}

async function apiDeleteClient(id){
    const r = await fetch(`${API_BASE}/clients/${encodeURIComponent(id)}`, { method: 'DELETE' })
    if(!r.ok){
        const msg = await safeReadError(r)
        throw new Error(msg)
    }
    return await r.json()
}

async function safeReadError(r){
    try{
        const data = await r.json()
        return data?.error ? data.error : `Erro HTTP ${r.status}`
    }catch{
        return `Erro HTTP ${r.status}`
    }
}

// ---------- CRUD (mantendo visual e fluxo) ----------
const readClient = () => __cacheClients

async function loadClients(){
    __cacheClients = await apiGetClients()
    updateTable()
}

async function createClient(client){
    await apiCreateClient(client)
    await loadClients()
}

async function updateClientByIndex(index, client){
    const current = readClient()[index]
    if(!current) throw new Error('Cliente inválido')
    await apiUpdateClient(current.id, client)
    await loadClients()
}

async function deleteClientByIndex(index){
    const current = readClient()[index]
    if(!current) throw new Error('Cliente inválido')
    await apiDeleteClient(current.id)
    await loadClients()
}

//interação com o layout
const saveClient = async () => {
    if(isValidFields()){
        const client = {
            nome: document.getElementById('nome').value,
            email: document.getElementById('email').value,
            celular: document.getElementById('celular').value,
            cidade: document.getElementById('cidade').value,
        } 
        const index = document.getElementById('nome').dataset.index

        try{
            if(index == 'new'){
                await createClient(client)
                closeModal()
            }else{
                await updateClientByIndex(index, client)
                closeModal()
            }
        }catch(e){
            alert(e.message || 'Erro ao salvar')
        }
    }
}

const createRow = (client, index) => {
    const newRow = document.createElement('tr')
    newRow.innerHTML = `
    <td>${client.nome}</td>
    <td>${client.email}</td>
    <td>${client.celular}</td>
    <td>${client.cidade}</td>
    <td>
        <button type="button" class="button green" id="edit-${index}">Editar</button>
        <button type="button" class="button red" id="delete-${index}">Excluir</button>
    </td>
    `
    document.querySelector('#tableClient>tbody').appendChild(newRow)
}

const clearTable = () => {
    const rows = document.querySelectorAll('#tableClient>tbody tr')
    rows.forEach(row => row.parentNode.removeChild(row))
}

const updateTable = () => {
    const dbClient = readClient()
    clearTable()
    dbClient.forEach(createRow)
}

const fillFields = (client) => {
    document.getElementById('nome').value = client.nome
    document.getElementById('email').value = client.email
    document.getElementById('celular').value = client.celular
    document.getElementById('cidade').value = client.cidade
    document.getElementById('nome').dataset.index = client.index
}

const editClient = (index) => {
    const client = readClient()[index]
    client.index = index
    fillFields(client)
    openModal()
}

const editDelete = async (event) => {
    if ( event.target.type == 'button'){
        const [action, index] = event.target.id.split('-') 
        if (action == 'edit'){
            editClient(index)
        }else{
            const client = readClient()[index]
            const resposta = confirm(`Deseja realmente excluir o cliente ${client.nome}`)
            if (resposta) {
                try{
                    await deleteClientByIndex(index)
                }catch(e){
                    alert(e.message || 'Erro ao excluir')
                }
            }
        }
    }
}

// Boot
loadClients().catch(e => alert(e.message || 'Falha ao carregar clientes'))

//eventos
document.getElementById('cadastrarCliente')
    .addEventListener('click', openModal)

document.getElementById('modalClose')
    .addEventListener('click', closeModal)

document.getElementById('salvar')
    .addEventListener('click', saveClient)

document.querySelector('#tableClient>tbody')
    .addEventListener('click', editDelete)

document.getElementById('cancelar')
    .addEventListener('click', closeModal)
