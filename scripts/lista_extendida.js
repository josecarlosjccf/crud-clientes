/**
 * Controlador da página de edição/cadastro de cliente.
 * Gerencia formulário, carregamento de dados, alternância PF/PJ e salvamento.
 */
class ListaExpandidaController {
    constructor() {
        // Configurações de caminhos de API e arquivos
        this.config = {
            apiClientes: '/api/clientes',
            arquivoEstados: 'data/estados.json',  // Caminho para o arquivo de estados
            arquivoCidades: 'data/cidades.json',  // Caminho para o arquivo de cidades
            paginaLista: 'lista_clientes.html'
        };

        this.api = new ApiService();
        this.formManager = new FormManager();
        this.clienteId = null;
        this.tipoPessoa = 'pf'; // Valor padrão

        // Guarda os dados de cidades já carregados para evitar reloads e facilitar acesso
        this.estados = [];
        this.cidades = [];

        this.init();
    }

    /**
     * Inicializa a aplicação.
     * Determina se é edição ou novo cadastro.
     * Inicializa alternância PF/PJ, carrega estados/cidades e configura eventos.
     */
    async init() {
        // Extrai ID da URL se existir
        this.clienteId = this.extrairIdDaUrl();
        this.configurarAlternanciaTipo();

        // Carrega lista de estados e cidades uma vez só!
        await this.carregarEstadosECidades();

        // Carrega estados no select
        this.preencherSelect('estado', this.estados, 'Selecione um estado', 'ID');

        // Se for edição, carrega os dados do cliente
        if (this.clienteId) {
            await this.carregarDadosCliente();
        } else {
            // Gera novo ID ao carregar a página para novo cadastro
            document.getElementById('id').value = this.gerarNovoId();
        }

        this.configurarEventos();
    }

    /**
     * Extrai ID do cliente da URL.
     * @returns {string|null}
     */
    extrairIdDaUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id');
    }

    /**
     * Lida com alternância de PF/PJ, já selecionando PJ se passado por parâmetro.
     */
    configurarAlternanciaTipo() {
        const btnPF = document.getElementById('btnPF');
        const btnPJ = document.getElementById('btnPJ');
        const divInscricaoEstadual = document.getElementById('divInscricaoEstadual');
        const labelCodigoFiscal = document.getElementById('labelCodigoFiscal');
        const labelNome = document.getElementById('labelNome');
        const labelData = document.getElementById('labelData');
        const inputCodigoFiscal = document.getElementById('codigoFiscal');
        const inputNome = document.getElementById('nome');
        const inputData = document.getElementById('dataNascimento');

        const setTipo = (tipo) => {
            this.tipoPessoa = tipo;

            if (tipo === 'pf') {
                btnPF.classList.add('active');
                btnPJ.classList.remove('active');
                divInscricaoEstadual.classList.add('d-none');
                labelCodigoFiscal.innerText = 'CPF';
                inputCodigoFiscal.placeholder = 'Digite o CPF';
                labelNome.innerText = 'Nome Completo';
                inputNome.placeholder = 'Digite o nome completo';
                labelData.innerText = 'Data de Nascimento';
                inputData.placeholder = '';
            } else {
                btnPF.classList.remove('active');
                btnPJ.classList.add('active');
                divInscricaoEstadual.classList.remove('d-none');
                labelCodigoFiscal.innerText = 'CNPJ';
                inputCodigoFiscal.placeholder = 'Digite o CNPJ';
                labelNome.innerText = 'Razão Social';
                inputNome.placeholder = 'Digite a razão social';
                labelData.innerText = 'Data de Abertura';
                inputData.placeholder = '';
            }
        };

        btnPF.addEventListener('click', () => setTipo('pf'));
        btnPJ.addEventListener('click', () => setTipo('pj'));

        // Se URL tiver ?tipo=pj, já seleciona PJ ao entrar
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('tipo') === 'pj') {
            setTipo('pj');
        } else {
            setTipo('pf');
        }
    }

    /**
     * Carrega estados e cidades (apenas uma vez, tudo em memória!)
     */
    async carregarEstadosECidades() {
        try {
            this.estados = await this.carregarDados(this.config.arquivoEstados);
            this.cidades = await this.carregarDados(this.config.arquivoCidades);
        } catch (erro) {
            this.estados = [];
            this.cidades = [];
            this.exibirAlerta('Erro ao carregar lista de estados/cidades', 'error');
        }
    }

    /**
     * Helper para carregar dados dos arquivos JSON
     * @param {string} arquivo
     * @returns {Promise<any>}
     */
    async carregarDados(arquivo) {
        const resposta = await fetch(arquivo);
        if (!resposta.ok) throw new Error(`Erro HTTP: ${resposta.status}`);
        return resposta.json();
    }

    /**
     * Preenche um select com opções.
     * @param {string} idSelect
     * @param {Array} dados
     * @param {string} textoPadrao
     * @param {string} campoValor
     */
    preencherSelect(idSelect, dados, textoPadrao, campoValor = 'Nome') {
        const select = document.getElementById(idSelect);
        select.innerHTML = `<option value="">${textoPadrao}</option>`;
        dados.forEach(item => {
            const opt = document.createElement('option');
            opt.value = campoValor && item[campoValor] !== undefined ? item[campoValor] : item.Nome;
            opt.textContent = item.Nome;
            select.appendChild(opt);
        });
        select.disabled = false;
    }

    /**
     * Preenche cidades do estado selecionado.
     * @param {string} estadoId
     * @param {string} cidadeSelecionada (opcional)
     */
    preencherCidadesDoEstado(estadoId, cidadeSelecionada = '') {
        // Filtra cidades do estado (no JSON cidades, campo Estado é o ID do estado)
        const cidadesFiltradas = this.cidades.filter(c => String(c.Estado) === String(estadoId));
        this.preencherSelect('cidade', cidadesFiltradas, 'Selecione uma cidade', 'ID');
        // Seleciona cidade se passado
        if (cidadeSelecionada) {
            document.getElementById('cidade').value = cidadeSelecionada;
        }
    }

    /**
     * Exibe alerta simples (pode ser adaptado para UI customizada)
     */
    exibirAlerta(msg, tipo) {
        alert(msg); // Pode ser customizado para UI de alerta
    }

    /**
     * Carrega dados do cliente para edição.
     * Preenche formulário e executa alternância de tipo.
     */
    async carregarDadosCliente() {
        try {
            const cliente = await this.api.get(`/clientes/${this.clienteId}`);
            // Alterna tipo PF/PJ no formulário conforme os dados do cliente
            if (cliente.tipo === 'pj') {
                document.getElementById('btnPJ').click();
            } else {
                document.getElementById('btnPF').click();
            }
            // Preenche formulário
            this.formManager.preencherFormulario(cliente, cliente.tipo);

            // Preenche cidades do estado do cliente, se houver
            if (cliente.endereco && cliente.endereco.estado) {
                this.preencherCidadesDoEstado(cliente.endereco.estado, cliente.endereco.cidade);
            }
        } catch (error) {
            alert('Erro ao carregar dados do cliente');
            window.location.href = this.config.paginaLista;
        }
    }

    /**
     * Carrega cidades baseado no estado selecionado (compatível com API antiga, mas agora só usa JSON em memória)
     * @param {string} estadoId
     * @param {string} cidadeSelecionada
     */
    async carregarCidades(estadoId, cidadeSelecionada) {
        this.preencherCidadesDoEstado(estadoId, cidadeSelecionada);
    }

    /**
     * Gera novo ID único para cliente no padrão desejado.
     * Ex: 84I0V2F9
     * @returns {string}
     */
    gerarNovoId() {
        // Usa hora para garantir unicidade e letras maiúsculas
        const base = (Date.now() + Math.floor(Math.random() * 10000)).toString(36).toUpperCase();
        return base.slice(-8);
    }

    /**
     * Configura eventos do formulário.
     */
    configurarEventos() {
        // Evento para mudança de estado (preenche cidades do estado)
        const selectEstado = document.getElementById('estado');
        selectEstado.addEventListener('change', (e) => {
            const estadoId = e.target.value;
            this.preencherCidadesDoEstado(estadoId);
        });

        // Evento para submissão do formulário
        const form = document.querySelector('form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.salvarCliente();
        });

        // Evento de reset limpa cidades e estados
        form.addEventListener('reset', () => {
            setTimeout(() => {
                this.formManager.limparSelectCidades();
                document.getElementById('estado').selectedIndex = 0;
                document.getElementById('id').value = this.gerarNovoId();
                document.getElementById('imagem').value = '';
                this.formManager.limparPreviewImagem();
            }, 100);
        });
    }

    /**
     * Salva dados do cliente (criação ou atualização), gerenciando imagem.
     */
    async salvarCliente() {
        try {
            const dadosFormulario = this.formManager.coletarDados(this.tipoPessoa);

            // ID já preenchido para novo cadastro ou edição
            if (!this.clienteId) {
                dadosFormulario.id = document.getElementById('id').value;
                dadosFormulario.dataCadastro = new Date().toISOString();
            } else {
                dadosFormulario.id = this.clienteId;
            }

            dadosFormulario.tipo = this.tipoPessoa;
            dadosFormulario.userIconPath = `data/user_icon/${dadosFormulario.id}.png`;

            // Lida com upload de imagem (opcional)
            await this.formManager.salvarImagemCliente(dadosFormulario.id);

            // Salva no servidor
            if (this.clienteId) {
                await this.api.put(`/clientes/${this.clienteId}`, dadosFormulario);
                alert('Cliente atualizado com sucesso!');
            } else {
                await this.api.post('/clientes', dadosFormulario);
                alert('Cliente cadastrado com sucesso!');
            }
            window.location.href = this.config.paginaLista;
        } catch (error) {
            alert('Erro ao salvar cliente');
        }
    }
}

/**
 * Serviço para comunicação com a API
 */
class ApiService {
    constructor() {
        this.baseUrl = '/api';
    }
    async get(endpoint) {
        const response = await fetch(`${this.baseUrl}${endpoint}`);
        if (!response.ok) throw new Error('Erro na requisição GET');
        return response.json();
    }
    async post(endpoint, dados) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        if (!response.ok) throw new Error('Erro na requisição POST');
        return response.json();
    }
    async put(endpoint, dados) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        if (!response.ok) throw new Error('Erro na requisição PUT');
        return response.json();
    }
}

/**
 * Gerenciador do formulário
 */
class FormManager {
    constructor() {
        this.inputImagem = document.getElementById('imagem');
        this.configurarPreviewImagem();
    }

    /**
     * Preenche formulário com dados do cliente, inclusive cidade/estado e imagem.
     */
    async preencherFormulario(cliente, tipo) {
        // ID
        document.getElementById('id').value = cliente.id || '';
        // Tipo
        // PF/PJ alternância já foi feita pelo controller

        // Dados de documento
        document.getElementById('codigoFiscal').value = cliente.codigoFiscal || '';
        document.getElementById('nome').value = cliente.nome || '';
        document.getElementById('dataNascimento').value = cliente.data || '';
        if (tipo === 'pj') {
            document.getElementById('inscricaoEstadual').value = cliente.inscricaoEstadual || '';
            document.getElementById('nomeFantasia').value = cliente.nomeFantasia || '';
        } else {
            document.getElementById('inscricaoEstadual').value = '';
            document.getElementById('nomeFantasia').value = '';
        }
        // Endereço
        if (cliente.endereco) {
            document.getElementById('endereco').value = cliente.endereco.logradouro || '';
            document.getElementById('numero').value = cliente.endereco.numero || '';
            document.getElementById('bairro').value = cliente.endereco.bairro || '';
            // Estado
            document.getElementById('estado').value = cliente.endereco.estado || '';
            // Cidade será preenchida pelo controller após preencherCidadesDoEstado
        }
        // Imagem de preview
        if (cliente.userIconPath) {
            this.exibirImagemPreview(cliente.userIconPath);
        }
    }

    /**
     * Coleta todos os dados do formulário (PF ou PJ).
     * @param {string} tipoPessoa
     * @returns {Object}
     */
    coletarDados(tipoPessoa) {
        const endereco = {
            logradouro: document.getElementById('endereco').value.trim(),
            numero: document.getElementById('numero').value.trim(),
            bairro: document.getElementById('bairro').value.trim(),
            cidade: document.getElementById('cidade').value,
            estado: document.getElementById('estado').value
        };
        const form = {
            codigoFiscal: document.getElementById('codigoFiscal').value.trim(),
            nome: document.getElementById('nome').value.trim(),
            data: document.getElementById('dataNascimento').value,
            endereco,
        };
        if (tipoPessoa === 'pj') {
            form.inscricaoEstadual = document.getElementById('inscricaoEstadual').value.trim();
            form.nomeFantasia = document.getElementById('nomeFantasia').value.trim();
        }
        return form;
    }

    /**
     * Popula select de estados.
     * @param {Array} estados
     */
    popularSelectEstados(estados) {
        const select = document.getElementById('estado');
        select.innerHTML = `<option value="">Selecione o estado</option>`;
        estados.forEach(estado => {
            const opt = document.createElement('option');
            opt.value = estado.ID;
            opt.textContent = estado.Nome;
            select.appendChild(opt);
        });
    }

    /**
     * Popula select de cidades, já selecionando se fornecido.
     * @param {Array} cidades
     * @param {string} cidadeSelecionada
     */
    popularSelectCidades(cidades, cidadeSelecionada) {
        const select = document.getElementById('cidade');
        select.innerHTML = `<option value="">Selecione a cidade</option>`;
        cidades.forEach(cidade => {
            const opt = document.createElement('option');
            opt.value = cidade.ID;
            opt.textContent = cidade.Nome;
            select.appendChild(opt);
        });
        select.disabled = false;
        if (cidadeSelecionada) {
            select.value = cidadeSelecionada;
        }
    }

    /**
     * Limpa select de cidades.
     */
    limparSelectCidades() {
        const select = document.getElementById('cidade');
        select.innerHTML = `<option value="">Selecione a cidade</option>`;
        select.disabled = true;
    }

    /**
     * Configura preview da imagem.
     */
    configurarPreviewImagem() {
        this.previewImg = null;
        this.inputImagem.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    this.exibirImagemPreview(ev.target.result);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    exibirImagemPreview(src) {
        let img = document.getElementById('previewImagem');
        if (!img) {
            img = document.createElement('img');
            img.id = 'previewImagem';
            img.style.display = 'block';
            img.style.maxWidth = '120px';
            img.style.marginTop = '8px';
            document.getElementById('imagem').parentElement.appendChild(img);
        }
        img.src = src;
        img.style.display = 'block';
    }

    limparPreviewImagem() {
        const img = document.getElementById('previewImagem');
        if (img) img.style.display = 'none';
    }

    /**
     * Salva imagem do cliente (caso o arquivo tenha sido selecionado).
     * Faz upload via API ou salva localmente, dependendo do backend.
     */
    async salvarImagemCliente(idCliente) {
        // Se não houver arquivo selecionado, não faz nada.
        if (!this.inputImagem || !this.inputImagem.files || !this.inputImagem.files[0]) return;
        const file = this.inputImagem.files[0];
        // Envia imagem via fetch para endpoint específico (backend deve tratar)
        const formData = new FormData();
        formData.append('imagem', file, `${idCliente}.png`);
        await fetch(`/api/upload-imagem/${idCliente}`, {
            method: 'POST',
            body: formData
        });
    }
}

// Variável global do controlador
window.controller = null;

/**
 * Inicialização da aplicação quando DOM estiver carregado
 */
document.addEventListener('DOMContentLoaded', () => {
    window.controller = new ListaExpandidaController();
});