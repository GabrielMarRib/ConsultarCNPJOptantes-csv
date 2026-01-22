const { app, BrowserWindow, ipcMain } = require('electron');
const path = require("node:path");
const fs = require("fs");
const { parse, writeToPath } = require("fast-csv");

let botRodando = false;
let mainWindow;
let delimitadorEscolhido;

const lerCsv = (nomeArquivo) => {
  return new Promise((resolve, reject) => {
    const dados = [];
    const pastaBase = app.isPackaged ? path.dirname(process.execPath) : __dirname;
    const CAMINHO_ARQUIVO = path.resolve(pastaBase, `./excel/${nomeArquivo}`);
    
    if (!fs.existsSync(CAMINHO_ARQUIVO)) {
        return reject(`Arquivo "${nomeArquivo}" não encontrado na pasta 'excel'.`);
    }

   
    const streamDetector = fs.createReadStream(CAMINHO_ARQUIVO, { start: 0, end: 1024, encoding: 'utf8' });

    streamDetector.on('data', (chunk) => {
        streamDetector.destroy(); // Para a leitura imediatamente (não precisa ler o arquivo todo agora)
        const primeiraLinha = chunk.split('\n')[0];
        const countPontoVirgula = (primeiraLinha.match(/;/g) || []).length;
        const countVirgula = (primeiraLinha.match(/,/g) || []).length;
         delimitadorEscolhido = countPontoVirgula > countVirgula ? ';' : ',';
        fs.createReadStream(CAMINHO_ARQUIVO)
          .pipe(parse({ headers: true, delimiter: delimitadorEscolhido })) 
          .on('error', error => reject(error))
          .on('data', row => dados.push(row))
          .on('end', () => resolve(dados));
    });
    streamDetector.on('error', err => reject(err));
  });
};

const SalvarCSV = (dados, nomeArquivo) => {
  return new Promise((resolve, reject) => {
    const CAMINHO_ARQUIVO = path.resolve(__dirname, `./excel/${nomeArquivo}`);
    writeToPath(CAMINHO_ARQUIVO, dados, { headers: true, delimiter: delimitadorEscolhido }) 
      .on('error', err => reject(err))
      .on('finish', () => resolve());
  });
};

// ... (Create Window e App Ready continuam iguais) ...

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900, // Aumentei um pouco a largura
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

// ... (Logs continuam iguais) ...
function enviarLog(mensagem) {
    if (mainWindow) mainWindow.webContents.send('log-atualizacao', mensagem);
    console.log(mensagem);
}


ipcMain.on('bot-iniciar', async (event, nomeArquivoRecebido) => {
    if (botRodando) return;
    botRodando = true;
    
    enviarLog(`🚀 Iniciando Bot com arquivo: ${nomeArquivoRecebido}`);

    try {
        enviarLog("📂 Lendo arquivo CSV...");
        
        // Passamos o nome recebido para a função
        const DadosCSV = await lerCsv(nomeArquivoRecebido);

        const listaPendentes = DadosCSV.filter(linha => 
            linha.status !== 'SIM' && 
            linha.status !== 'NÃO' && 
            linha.status !== 'CNPJ não encontrado'
        );

        enviarLog(`📊 Total: ${DadosCSV.length} | Pendentes: ${listaPendentes.length}`);

        for (let i = 0; i < listaPendentes.length; i += 3) {
            if (!botRodando) {
                enviarLog("🛑 Bot interrompido!");
                break; 
            }

            enviarLog(`\n📦 Processando ${i} a ${Math.min(i+3, listaPendentes.length)}...`);
            let loteAtual = listaPendentes.slice(i, i + 3);

            const requisicoes = loteAtual.map(linha => {
                if(!linha.cnpj) return Promise.resolve({ linhaObj: linha, sucesso: false, erro: 'CNPJ Vazio' });
                let cnpjLimpo = String(linha.cnpj).trim().replace(/\D/g, ''); // Limpeza mais robusta

                return fetch(`https://api.opencnpj.org/${cnpjLimpo}`)
                    .then(async r => {
                        if (!r.ok) throw new Error(`HTTP ${r.status}`);
                        return r.json();
                    })
                    .then(dados => ({ linhaObj: linha, sucesso: true, dados: dados })) 
                    .catch(erro => ({ linhaObj: linha, sucesso: false, erro: erro.message || erro }));
            });
            
            const resultados = await Promise.all(requisicoes);

            resultados.forEach(res => {
                if (res.sucesso) {
                    if (res.dados.opcao_simples === "S") {
                        enviarLog(`   ✅ ${res.linhaObj.cnpj}: SIMPLES`);
                        res.linhaObj.status = 'SIM'; 
                    } else {
                        enviarLog(`   ⚠️ ${res.linhaObj.cnpj}: Não simples`);
                        res.linhaObj.status = 'NÃO';
                    }
                } else {
                   
                    if(String(res.erro).includes('403') || String(res.erro).includes('404')){
                        res.linhaObj.status = `CNPJ não encontrado`;
                        enviarLog(`   ❌ ${res.linhaObj.cnpj}: Erro - CNPJ não encontrado`);
                    } else {
                         enviarLog(`   ❌ ${res.linhaObj.cnpj}: Erro - ${res.erro}`);
                        res.linhaObj.status = `ERRO: ${res.erro}`;
                    }
                }
            });

            await new Promise(r => setTimeout(r, 2000));  
        }
        
        enviarLog("\n💾 Salvando arquivo...");
        // Passamos o nome recebido para salvar no mesmo lugar
        await SalvarCSV(DadosCSV, nomeArquivoRecebido);
        
        enviarLog("🏁 Finalizado!");

    } catch (error) {
        enviarLog(`💥 Erro: ${error.message || error}`);
    } finally {
        botRodando = false;
        event.sender.send('bot-status-finalizado');
    }
});

ipcMain.on('bot-parar', () => {
    if (botRodando) {
        enviarLog("⚠️ Solicitando parada...");
        botRodando = false;
    }
});