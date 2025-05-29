/**
 * Controlador principal da lista de clientes.
 * Resolve nome do estado/cidade no frontend usando arquivos locais.
 */
class ListaClientesController {
    constructor() {
        this.api = new ApiService();
        this.renderer = new TableRenderer();
        this.estados = [];
        this.cidades = [];
        this.init();
    }

    async init() {
        await this.carregarEstadosECidades();
        await this.carregarClientes();
        this.adicionarEstilosTabela();
    }

    // Carrega estados e cidades do JSON local para resolver nomes no front
    async carregarEstadosECidades() {
        try {
            const [estados, cidades] = await Promise.all([
                fetch('data/estados.json').then(r => r.json()),
                fetch('data/cidades.json').then(r => r.json()),
            ]);
            this.estados = estados;
            this.cidades = cidades;
        } catch (error) {
            this.estados = [];
            this.cidades = [];
        }
    }

    async carregarClientes() {
        try {
            const clientes = await this.api.get('/clientes');
            // Adiciona nomes cidade/estado no frontend usando os arquivos carregados
            const clientesComNomeCidadeEstado = clientes.map(cliente => {
                let estadoNome = '';
                let cidadeNome = '';
                const estadoId = cliente.endereco?.estado || cliente.estado;
                const cidadeId = cliente.endereco?.cidade || cliente.cidade;
                if (estadoId) {
                    const est = this.estados.find(e => String(e.ID) === String(estadoId) || e.Sigla === estadoId);
                    estadoNome = est ? est.Nome : (cliente.estado || '');
                }
                if (cidadeId) {
                    const cid = this.cidades.find(c => String(c.ID) === String(cidadeId));
                    cidadeNome = cid ? cid.Nome : (cliente.cidade || '');
                }
                return { ...cliente, _nomeEstado: estadoNome, _nomeCidade: cidadeNome };
            });
            this.renderer.renderizar(clientesComNomeCidadeEstado);
        } catch (error) {
            this.renderer.renderizarErro('Erro ao carregar clientes');
        }
    }

    async excluirCliente(id) {
        if (confirm('Tem certeza que deseja excluir este cliente?')) {
            try {
                await this.api.delete(`/clientes/${id}`);
                await this.carregarClientes();
                alert('Cliente excluído com sucesso!');
            } catch (error) {
                alert('Erro ao excluir cliente');
            }
        }
    }

    editarCliente(id) {
        window.location.href = `lista_expandida.html?id=${id}`;
    }

    adicionarEstilosTabela() {
        const style = document.createElement('style');
        style.textContent = `
            table {
                border-collapse: collapse;
                width: 100%;
                margin-top: 20px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            table, th, td {
                border: 1px solid #dee2e6;
            }
            th, td {
                padding: 10px 8px;
                text-align: left;
                vertical-align: top;
            }
            th {
                background-color: #f8f9fa;
                font-weight: bold;
                color: #495057;
            }
            tbody tr:nth-child(even) {
                background-color: #f8f9fa;
            }
            tbody tr:hover {
                background-color: #e9ecef;
                transition: background-color 0.2s;
            }
            .user-image {
                width: 48px;
                height: 48px;
                border-radius: 50%;
                object-fit: cover;
                border: 2px solid #dee2e6;
                margin-right: 10px;
                vertical-align: middle;
                background-color: #f1f1f1;
                transition: none !important;
            }
            .user-image.sem-foto {
                background: #e0e0e0;
                color: #888;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 22px;
                font-weight: bold;
                border: 2px solid #dee2e6;
            }
            .user-placeholder {
                width: 48px;
                height: 48px;
                border-radius: 50%;
                background: #e0e0e0;
                color: #888;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 22px;
                font-weight: bold;
                margin-right: 10px;
                border: 2px solid #dee2e6;
            }
            .cliente-info {
                display: flex;
                align-items: flex-start;
            }
            .cliente-detalhes {
                line-height: 1.3;
                font-size: 1.04em;
            }
            .campo-label {
                font-weight: bold;
                color: #495057;
            }
            .campo-valor {
                margin-left: 3px;
            }
            .btn {
                margin-bottom: 3px;
            }
            @media (max-width: 768px) {
                .user-image, .user-placeholder {
                    width: 32px;
                    height: 32px;
                    font-size: 0.9em;
                }
                th, td {
                    padding: 7px 4px;
                    font-size: 0.94em;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

class ApiService {
    constructor() {
        this.baseUrl = '/api';
    }
    async get(endpoint) {
        const response = await fetch(`${this.baseUrl}${endpoint}`);
        if (!response.ok) throw new Error('Erro na requisição GET');
        return response.json();
    }
    async delete(endpoint) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Erro na requisição DELETE');
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
 * Renderizador da tabela de clientes.
 */
class TableRenderer {
    constructor() {
        // Espera que exista um <tbody> na página
        this.tbody = document.querySelector('tbody');
        if (!this.tbody) this.criarTabelaBase();
        this.tbody = document.querySelector('tbody');
        this.formatter = new ClienteFormatter();
    }

    renderizar(clientes) {
        if (!this.tbody) return;
        this.tbody.innerHTML = clientes.length === 0
            ? '<tr><td colspan="4" class="text-center">Nenhum cliente cadastrado</td></tr>'
            : clientes.map(c => this.criarLinha(c)).join('');
    }

    renderizarErro(msg) {
        if (!this.tbody) return;
        this.tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">${msg}</td></tr>`;
    }

    criarLinha(cliente) {
        // Usa _nomeEstado e _nomeCidade já resolvidos no frontend
        // Agora mostra dentro da área formatada do cliente, com título igual aos demais campos

        return `<tr>
            <td>
                <div class="cliente-info">
                    ${this.criarImagemOuPlaceholder(cliente)}
                    <div class="cliente-detalhes">
                        ${this.formatter.formatar(cliente)}
                        ${this.formatter.formatarCampo('Estado', cliente._nomeEstado || '-')}
                        ${this.formatter.formatarCampo('Cidade', cliente._nomeCidade || '-')}
                    </div>
                </div>
            </td>
            <td style="vertical-align:middle;">
                <button class="btn btn-warning btn-sm me-2" onclick="controller.editarCliente('${cliente.id}')">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn btn-danger btn-sm" onclick="controller.excluirCliente('${cliente.id}')">
                    <i class="fas fa-trash"></i> Excluir
                </button>
            </td>
        </tr>`;
    }

    criarImagemOuPlaceholder(cliente) {
        // Se houver foto definida, tenta mostrar a imagem. Se não, mostra um placeholder com ícone de pessoa.
        const imagemPath = cliente.userIconPath && cliente.userIconPath !== '' ? cliente.userIconPath : `data/user_icon/${cliente.id}.png`;
        // Mostra imagem se existe, senão mostra placeholder de usuário
        // O truque é usar uma função JS inline para tratar o erro e esconder a imagem, mostrando o placeholder
        const nome = (cliente.nome || cliente.razaoSocial || '').trim();
        const iniciais = this.obterIniciais(nome);
        // id único para placeholder
        const placeholderId = `ph_${cliente.id}`;

        return `
            <img src="${imagemPath}" 
                 alt="Foto do cliente" 
                 class="user-image"
                 style="display:inline-block;"
                 onerror="this.style.display='none';document.getElementById('${placeholderId}').style.display='flex';">
            <div id="${placeholderId}" class="user-placeholder" style="display:none;">
                <span title="Usuário sem foto">&#128100;</span>
            </div>
        `;
    }

    obterIniciais(nome) {
        if (!nome) return '';
        const partes = nome.split(' ').filter(Boolean);
        if (partes.length === 1) {
            return partes[0].substring(0, 2).toUpperCase();
        }
        return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
    }

    criarTabelaBase() {
        // Caso não exista a tabela, cria dinamicamente
        const container = document.querySelector('.card-body');
        if (!container) return;
        const table = document.createElement('table');
        table.classList.add('table', 'table-striped');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Cliente</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        container.appendChild(table);
    }
}

/**
 * Formatador de dados do cliente.
 */
class ClienteFormatter {
    formatar(cliente) {
        const campos = [
            this.formatarCampo('ID', cliente.id),
            this.formatarCampo(cliente.tipo === 'pf' ? 'Nome' : 'Razão Social', cliente.nome),
            this.formatarDocumento(cliente),
            this.formatarCampo(cliente.tipo === 'pf' ? 'Data Nasc.' : 'Abertura', this.formatarData(cliente.data)),
            this.formatarEndereco(cliente),
            this.formatarCampo('Data Cadastro', this.formatarDataHora(cliente.dataCadastro))
        ];
        return campos.filter(Boolean).join('');
    }

    formatarCampo(label, valor) {
        if (!valor) return '';
        return `<span class="campo-label">${label}:</span> <span class="campo-valor">${valor}</span><br>`;
    }

    formatarDocumento(cliente) {
        const doc = cliente.codigoFiscal;
        if (!doc) return '';
        if (cliente.tipo === 'pf') {
            // CPF: 000.000.000-00
            const cpfFormatado = doc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
            return this.formatarCampo('CPF', cpfFormatado);
        } else {
            // CNPJ: 00.000.000/0000-00
            const cnpjFormatado = doc.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
            return this.formatarCampo('CNPJ', cnpjFormatado);
        }
    }

    formatarEndereco(cliente) {
        if (!cliente.endereco) return '';
        const { logradouro, numero, bairro } = cliente.endereco;
        const enderecoCompleto = [
            logradouro,
            numero ? `nº ${numero}` : null,
            bairro
        ].filter(Boolean).join(', ');
        return enderecoCompleto ? this.formatarCampo('Endereço', enderecoCompleto) : '';
    }

    formatarData(data) {
        if (!data) return '';
        const dataObj = new Date(data + 'T00:00:00');
        return dataObj.toLocaleDateString('pt-BR');
    }

    formatarDataHora(dataHora) {
        if (!dataHora) return '';
        const dataObj = new Date(dataHora);
        return dataObj.toLocaleString('pt-BR');
    }
}

let controller;
document.addEventListener('DOMContentLoaded', () => {
    controller = new ListaClientesController();
});