const path = require("node:path");
const fs = require("fs");
const { parse, writeToPath } = require("fast-csv");

// CONFIGURAÇÕES
const NOME_DO_ARQUIVO = 'CNPJS_ColunaDireita.csv' // Esquerda cmd de baixo

const lerCsv = () => {
  return new Promise((resolve, reject) => {
    const dados = [];
    const CAMINHO_ARQUIVO = path.resolve(__dirname, `./excel/${NOME_DO_ARQUIVO}`);
    fs.createReadStream(CAMINHO_ARQUIVO)
      .pipe(parse({ headers: true, delimiter: ',' }))
      .on('error', error => reject(error))
      .on('data', row => dados.push(row))
      .on('end', () => resolve(dados));
  });
};

const SalvarCSV = (dados) => {
  return new Promise((resolve, reject) => {
    const CAMINHO_ARQUIVO = path.resolve(__dirname, `./excel/${NOME_DO_ARQUIVO}`);
    writeToPath(CAMINHO_ARQUIVO, dados, { headers: true, delimiter: ',' }) 
      .on('error', err => reject(err))
      .on('finish', () => resolve());
  });
};

(async () => {
    try {
        console.log("📂 Lendo arquivo CSV...");
        const DadosCSV = await lerCsv();

     
        const listaPendentes = DadosCSV.filter(linha => linha.status !== 'SIM' && linha.status !== 'NÃO' && linha.status !== 'CNPJ não encontrado');

        console.log(`📊 Relatório Inicial:`);
        console.log(`   - Total no arquivo: ${DadosCSV.length}`);
        console.log(`   - Já processados: ${DadosCSV.length - listaPendentes.length}`);
        console.log(`   - Faltam processar: ${listaPendentes.length}`);

      
        for (let i = 0; i < listaPendentes.length; i += 3) {
            
            console.log(`\n📦 Processando pendentes ${i} a ${Math.min(i+3, listaPendentes.length)}...`);
            
            let loteAtual = listaPendentes.slice(i, i + 3);

            const requisicoes = loteAtual.map(linha => {
                
                
                if(!linha.cnpj) return Promise.resolve({ linhaObj: linha, sucesso: false, erro: 'CNPJ Vazio' });

                let cnpjLimpo = String(linha.cnpj).trim()
                    .replaceAll('/', '')
                    .replaceAll('.', '')
                    .replaceAll('-', '');

             
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
                        console.log(`   ✅ ${res.linhaObj.cnpj}: É SIMPLES`);
                        res.linhaObj.status = 'SIM'; 
                    } else {
                        console.log(`   ⚠️ ${res.linhaObj.cnpj}: Não é simples`);
                        res.linhaObj.status = 'NÃO';
                    }
                } else {
                    console.log(`   ❌ ${res.linhaObj.cnpj}: Falhou - ${res.erro}`);
                    if(res.erro == 'HTTP 403'){
                        res.linhaObj.status = `CNPJ não encontrado`;
                    }
                    res.linhaObj.status = `ERRO: ${res.erro}`;
                }
            });

            await new Promise(r => setTimeout(r, 2000));  
        }
        
        console.log("\n💾 Salvando arquivo final (com todas as linhas)...");
        await SalvarCSV(DadosCSV);
        console.log("\n🏁 Fim do trabalho!");

    } catch (error) {
        console.error("💥 Erro fatal:", error);
    }
})();