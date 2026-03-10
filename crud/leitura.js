const fs = require('fs')

const caminho = __dirname + '/db.json'


const conteudo = fs.readFileSync(caminho, 'utf-8')
console.log(conteudo)