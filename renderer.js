const btnIniciar = document.getElementById('btnIniciar');
const btnParar = document.getElementById('btnParar');
const divLogs = document.getElementById('logs');
const inputCSV = document.getElementById('CSV'); 

const ultimoArquivoSalvo = localStorage.getItem('bot-ultimo-arquivo');
if (ultimoArquivoSalvo) {
    inputCSV.value = ultimoArquivoSalvo;
}
let Timer = null;
inputCSV.addEventListener('input', ()=> {
    if (Timer) {
        clearTimeout(Timer);
    }
    Timer = setTimeout(() => {
        const valorAtual = inputCSV.value;
        localStorage.setItem('bot-ultimo-arquivo', valorAtual);
    }, 3000);
});

function logNaTela(texto) {
    const linha = document.createElement('div');
    linha.innerText = texto;
    divLogs.appendChild(linha);
    divLogs.scrollTop = divLogs.scrollHeight;
}

btnIniciar.addEventListener('click', () => {
    let nomeArquivo = inputCSV.value.trim();

    if (!nomeArquivo) {
        alert("Por favor, digite o nome do arquivo CSV!");
        return;
    }

    if (!nomeArquivo.toLowerCase().endsWith('.csv')) {
        nomeArquivo += '.csv';
    }


    localStorage.setItem('bot-ultimo-arquivo', nomeArquivo);
  

    divLogs.innerHTML = ''; 
    logNaTela(`Preparando para ler: ${nomeArquivo}...`);
    
    window.api.iniciar(nomeArquivo);
    
    btnIniciar.disabled = true;
    btnIniciar.innerText = "Rodando...";
    inputCSV.disabled = true; 
});

btnParar.addEventListener('click', () => {
    window.api.parar();
});

window.api.aoReceberLog((texto) => logNaTela(texto));

window.api.aoFinalizar(() => {
    btnIniciar.disabled = false;
    inputCSV.disabled = false;
    btnIniciar.innerText = "▶ Iniciar";
    logNaTela("--- FIM DA EXECUÇÃO ---");
});