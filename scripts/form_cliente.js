/**
 * Classe responsável pelo gerenciamento do formulário de cadastro de clientes,
 * incluindo o envio de imagem para o servidor, validação e geração de ID.
 */
class FormularioCliente {
    constructor() {
        this.clientes = [];
        // Configurações de caminhos de API e arquivos
        this.config = {
            apiClientes: '/api/clientes',
            arquivoEstados: 'data/estados.json',
            arquivoCidades: 'data/cidades.json',
            paginaLista: 'lista_clientes.html'
        };
        this.iniciarQuandoCarregar();
    }

    // Inicializa a lógica da página ao carregar o DOM
    iniciarQuandoCarregar() {
        if (document.readyState === 'loading') {
            window.addEventListener('DOMContentLoaded', () => this.inicializar());
        } else {
            this.inicializar();
        }
    }

    // Fluxo principal de inicialização
    async inicializar() {
        try {
            this.definirTipoPadrao('pf');
            this.gerarNovoId();
            await this.carregarEstados();
            this.configurarEventos();
            await this.carregarClientesExistentes();
            this.criarBotaoExportacao();
        } catch (erro) {
            console.error('Erro na inicialização:', erro);
            this.exibirAlerta('Erro na inicialização do formulário!', 'error');
        }
    }

    // Configura todos os eventos do formulário
    configurarEventos() {
        // Alternância PF/PJ
        this.addEvento('btnPF', 'click', () => this.alternarTipoCliente('pf'));
        this.addEvento('btnPJ', 'click', () => this.alternarTipoCliente('pj'));
        // Carregar cidades ao mudar o estado
        this.addEvento('estado', 'change', (e) => {
            if (e.target.value) this.carregarCidadesPorEstado(e.target.value);
        });
        // Submissão do formulário
        const form = document.querySelector('form');
        if (form) form.onsubmit = (e) => { e.preventDefault(); this.processarSalvamento(); };
    }

    // Helper para adicionar eventos a elementos por ID
    addEvento(id, evento, callback) {
        const el = document.getElementById(id);
        if (el) el.addEventListener(evento, callback);
    }

    // Alterna para PF ou PJ e atualiza campos do formulário
    alternarTipoCliente(tipo) {
        const ehPJ = tipo === 'pj';
        const configs = {
            'btnPF': { classe: 'active', ativo: !ehPJ },
            'btnPJ': { classe: 'active', ativo: ehPJ },
            'labelCodigoFiscal': { texto: ehPJ ? 'CNPJ' : 'CPF' },
            'labelNome': { texto: ehPJ ? 'Razão Social' : 'Nome Completo' },
            'labelData': { texto: ehPJ ? 'Data de Abertura' : 'Data de Nascimento' },
            'codigoFiscal': { placeholder: `Digite o ${ehPJ ? 'CNPJ' : 'CPF'}` },
            'nome': { placeholder: `Digite ${ehPJ ? 'a Razão Social' : 'o nome completo'}` },
            'divInscricaoEstadual': { classe: 'd-none', ativo: !ehPJ }
        };
        Object.entries(configs).forEach(([id, config]) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (config.texto) el.textContent = config.texto;
            if (config.placeholder) el.placeholder = config.placeholder;
            if (config.classe) el.classList.toggle(config.classe, config.ativo);
        });
        this.gerarNovoId();
    }

    // Define o tipo padrão (PF/PJ)
    definirTipoPadrao(tipo) {
        this.alternarTipoCliente(tipo);
    }

    // Gera um ID alfanumérico para o cliente
    gerarNovoId() {
        const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const numeros = '0123456789';
        // Alterna letra-número-letra-número...
        const id = Array(8).fill().map((_, i) => {
            const chars = [2, 4, 6].includes(i) ? letras : numeros;
            return chars[Math.floor(Math.random() * chars.length)];
        }).join('');
        const campo = document.getElementById('id');
        if (campo) campo.value = id;
    }

    // Busca e retorna JSON de um arquivo local via fetch
    async carregarDados(arquivo) {
        const resposta = await fetch(arquivo);
        if (!resposta.ok) throw new Error(`Erro HTTP: ${resposta.status}`);
        return resposta.json();
    }

    // Carrega estados no select
    async carregarEstados() {
        try {
            const estados = await this.carregarDados(this.config.arquivoEstados);
            this.preencherSelect('estado', estados, 'Selecione um estado', 'Sigla');
        } catch (erro) {
            console.error('Erro ao carregar estados:', erro);
            this.exibirAlerta('Erro ao carregar lista de estados', 'error');
        }
    }

    // Carrega cidades para o estado selecionado
    async carregarCidadesPorEstado(estado) {
        try {
            const cidades = await this.carregarDados(this.config.arquivoCidades);
            const cidadesFiltradas = cidades.filter(c => c.Estado === estado);
            this.preencherSelect('cidade', cidadesFiltradas, 'Selecione uma cidade');
        } catch (erro) {
            console.error('Erro ao carregar cidades:', erro);
            this.exibirAlerta('Erro ao carregar lista de cidades', 'error');
        }
    }

    // Preenche um select com opções
    preencherSelect(id, dados, placeholder, extra = '') {
        const select = document.getElementById(id);
        if (!select) return;
        select.innerHTML = `<option value="">${placeholder}</option>`;
        dados.forEach(item => {
            const option = document.createElement('option');
            option.value = item.ID;
            option.textContent = extra ? `${item[extra]} - ${item.Nome}` : item.Nome;
            select.appendChild(option);
        });
    }

    // Carrega a lista de clientes existentes
    async carregarClientesExistentes() {
        try {
            const resposta = await fetch(this.config.apiClientes);
            if (resposta.ok) {
                this.clientes = await resposta.json();
            } else {
                this.clientes = [];
            }
        } catch (erro) {
            console.error('Erro ao carregar clientes:', erro);
            this.clientes = [];
        }
    }

    /**
     * Processa o salvamento do cliente, incluindo upload de imagem.
     * Envia todos os dados em um FormData para o backend.
     * Agora é obrigatório anexar uma imagem.
     */
    async processarSalvamento() {
        try {
            const cliente = this.coletarDadosFormulario();
            // Verifica campos obrigatórios
            if (!cliente.id || !cliente.codigoFiscal || !cliente.nome) {
                this.exibirAlerta('Preencha todos os campos obrigatórios!', 'error');
                return;
            }

            // Coleta imagem do campo "imagem"
            const inputImg = document.getElementById('imagem');
            const imagem = inputImg && inputImg.files.length > 0 ? inputImg.files[0] : null;

            // Valida se tem imagem (agora é obrigatório)
            if (!imagem) {
                this.exibirAlerta('É obrigatório anexar uma imagem do cliente!', 'error');
                return;
            }

            // Valida tamanho (15MB)
            if (imagem.size > 15 * 1024 * 1024) {
                this.exibirAlerta('A imagem deve ter no máximo 15 MB!', 'error');
                return;
            }

            // Monta FormData para envio
            const formData = new FormData();
            formData.append('cliente', JSON.stringify(cliente));
            formData.append('userIcon', imagem);

            // Faz o POST para a API
            const resposta = await fetch(this.config.apiClientes, {
                method: 'POST',
                body: formData
            });
            const resultado = await resposta.json();

            if (resposta.ok) {
                this.exibirAlerta(resultado.mensagem || 'Cliente salvo com sucesso!', 'success', () => {
                    window.location.href = this.config.paginaLista;
                });
            } else {
                this.exibirAlerta(resultado.erro || 'Erro ao salvar cliente!', 'error');
            }
        } catch (erro) {
            console.error('Erro ao salvar cliente:', erro);
            this.exibirAlerta('Erro de conexão com o servidor!', 'error');
        }
    }

    // Coleta os dados do formulário em um objeto
    coletarDadosFormulario() {
        const ehPJ = document.getElementById('btnPJ')?.classList.contains('active');
        const getVal = (id) => document.getElementById(id)?.value.trim() || '';
        const dados = {
            tipo: ehPJ ? 'pj' : 'pf',
            id: getVal('id'),
            codigoFiscal: getVal('codigoFiscal'),
            nome: getVal('nome'),
            data: getVal('dataNascimento'),
            endereco: {
                logradouro: getVal('endereco'),
                numero: getVal('numero'),
                bairro: getVal('bairro'),
                cidade: getVal('cidade'),
                estado: getVal('estado')
            }
        };
        if (ehPJ) {
            dados.inscricaoEstadual = getVal('inscricaoEstadual');
            dados.nomeFantasia = getVal('nomeFantasia');
        }
        return dados;
    }

    // Busca cliente por ID via API
    async buscarCliente(id) {
        try {
            const resposta = await fetch(`${this.config.apiClientes}/${id}`);
            if (resposta.ok) {
                return await resposta.json();
            }
            return null;
        } catch (erro) {
            console.error('Erro ao buscar cliente:', erro);
            return null;
        }
    }

    // Exibe alertas modais personalizados
    exibirAlerta(msg, tipo = 'info', callback = null) {
        const alertaExistente = document.querySelector('.alerta-personalizado');
        if (alertaExistente) alertaExistente.remove();
        const configs = {
            success: { icone: '✅', titulo: 'Sucesso!', cor: '#4CAF50' },
            error: { icone: '❌', titulo: 'Erro!', cor: '#f44336' },
            info: { icone: 'ℹ️', titulo: 'Informação', cor: '#2196F3' }
        };
        const config = configs[tipo] || configs.info;
        const overlay = document.createElement('div');
        overlay.className = 'alerta-personalizado';
        overlay.innerHTML = `
            <div class="alerta-modal">
                <div class="alerta-icone" style="color: ${config.cor}">${config.icone}</div>
                <h3 class="alerta-titulo">${config.titulo}</h3>
                <p class="alerta-mensagem">${msg}</p>
                <button class="alerta-botao" style="background: ${config.cor}">OK</button>
            </div>
        `;
        const fechar = () => {
            overlay.classList.remove('show');
            setTimeout(() => {
                if (overlay.parentNode) overlay.remove();
                if (callback) callback();
            }, 300);
        };
        overlay.querySelector('.alerta-botao').onclick = fechar;
        overlay.onclick = (e) => { if (e.target === overlay) fechar(); };
        this.addEstilosAlerta();
        document.body.appendChild(overlay);
        setTimeout(() => overlay.classList.add('show'), 10);
    }

    // Adiciona estilos CSS para os alertas
    addEstilosAlerta() {
        if (document.getElementById('estilos-alerta')) return;
        const style = document.createElement('style');
        style.id = 'estilos-alerta';
        style.textContent = `
            .alerta-personalizado { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 10000; opacity: 0; transition: opacity 0.3s ease; }
            .alerta-personalizado.show { opacity: 1; }
            .alerta-modal { background: white; border-radius: 12px; padding: 30px; text-align: center; max-width: 400px; width: 90%; box-shadow: 0 20px 40px rgba(0,0,0,0.3); transform: translateY(-20px); transition: transform 0.3s ease; }
            .alerta-personalizado.show .alerta-modal { transform: translateY(0); }
            .alerta-icone { font-size: 4rem; margin-bottom: 20px; }
            .alerta-titulo { font-size: 1.5rem; margin-bottom: 15px; color: #333; }
            .alerta-mensagem { font-size: 1.1rem; margin-bottom: 25px; color: #666; line-height: 1.5; }
            .alerta-botao { padding: 12px 25px; border: none; border-radius: 8px; color: white; font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.3s ease; min-width: 100px; }
            .alerta-botao:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
        `;
        document.head.appendChild(style);
    }

    // Cria botão para exportar o último cliente cadastrado
    criarBotaoExportacao() {
        if (document.getElementById('btnExportar')) return;
        const btn = document.createElement('button');
        Object.assign(btn, {
            id: 'btnExportar',
            className: 'btn btn-info w-100 mt-2',
            textContent: 'Exportar JSON do Último Cliente',
            type: 'button'
        });
        btn.onclick = () => this.exportarUltimoCliente();
        const container = document.createElement('div');
        container.className = 'col-md-12 mb-2';
        container.appendChild(btn);
        const row = document.querySelector('.row.mt-4');
        if (row) row.appendChild(container);
    }

    // Exporta o JSON do último cliente cadastrado
    async exportarUltimoCliente() {
        try {
            await this.carregarClientesExistentes();
            if (this.clientes.length === 0) {
                this.exibirAlerta('Nenhum cliente cadastrado para exportar!', 'info');
                return;
            }
            const cliente = this.clientes[this.clientes.length - 1];
            const blob = new Blob([JSON.stringify(cliente, null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `cliente_${cliente.id}.json`;
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
            }, 100);
        } catch (erro) {
            console.error('Erro ao exportar cliente:', erro);
            this.exibirAlerta('Erro ao exportar cliente!', 'error');
        }
    }
}

// Inicializa o formulário ao carregar o script
const formularioCliente = new FormularioCliente();