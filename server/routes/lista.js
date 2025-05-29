// server/routes/lista.js

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();
const multer = require('multer');

// Configuração para upload de imagem
const upload = multer({
    dest: path.join(__dirname, '..', '..', 'data', 'user_icon'),
    limits: { fileSize: 2 * 1024 * 1024 } // 2MB
});

class DataManager {
    constructor(file) {
        this.path = path.join(__dirname, '..', '..', 'data', file);
    }
    async read() {
        try {
            const data = await fs.readFile(this.path, 'utf8');
            return JSON.parse(data);
        } catch (e) {
            return e.code === 'ENOENT' ? [] : (() => { throw e; })();
        }
    }
    async write(data) {
        await fs.writeFile(this.path, JSON.stringify(data, null, 2));
    }
}

class ClienteController {
    constructor() {
        this.clientes = new DataManager('lista_clientes.json');
        this.estados = new DataManager('estados.json');
        this.cidades = new DataManager('cidades.json');
    }
    // GET /api/clientes
    async listar(req, res) {
        try {
            const clientes = await this.clientes.read();
            const estados = await this.estados.read();
            const cidades = await this.cidades.read();
            const result = clientes.map(cliente => {
                const clienteCompleto = { ...cliente };
                if (cliente.endereco?.estado) {
                    const estado = estados.find(e => e.ID === cliente.endereco.estado);
                    clienteCompleto.estado = estado ? estado.Nome : '';
                }
                if (cliente.endereco?.cidade) {
                    const cidade = cidades.find(c => c.ID === cliente.endereco.cidade);
                    clienteCompleto.cidade = cidade ? cidade.Nome : '';
                }
                return clienteCompleto;
            });
            res.json(result);
        } catch (error) {
            res.status(500).json({ erro: 'Erro interno do servidor' });
        }
    }
    // GET /api/clientes/:id
    async buscarPorId(req, res) {
        try {
            const clientes = await this.clientes.read();
            const cliente = clientes.find(c => c.id === req.params.id);
            if (cliente) {
                res.json(cliente);
            } else {
                res.status(404).json({ erro: 'Cliente não encontrado' });
            }
        } catch (error) {
            res.status(500).json({ erro: 'Erro interno do servidor' });
        }
    }
    // POST /api/clientes
    async criar(req, res) {
        try {
            const clientes = await this.clientes.read();
            const novoCliente = {
                ...req.body,
                dataCadastro: new Date().toISOString()
            };
            if (clientes.find(c => c.id === novoCliente.id)) {
                return res.status(400).json({ erro: 'ID já existe' });
            }
            clientes.push(novoCliente);
            await this.clientes.write(clientes);
            res.status(201).json({
                mensagem: 'Cliente criado com sucesso',
                cliente: novoCliente
            });
        } catch (error) {
            res.status(500).json({ erro: 'Erro interno do servidor' });
        }
    }
    // PUT /api/clientes/:id
    async atualizar(req, res) {
        try {
            const clientes = await this.clientes.read();
            const index = clientes.findIndex(c => c.id === req.params.id);
            if (index === -1) {
                return res.status(404).json({ erro: 'Cliente não encontrado' });
            }
            const clienteOriginal = clientes[index];
            const clienteAtualizado = {
                ...clienteOriginal,
                ...req.body,
                id: req.body.id || req.params.id,
                dataCadastro: clienteOriginal.dataCadastro,
                dataAtualizacao: new Date().toISOString()
            };
            clientes[index] = clienteAtualizado;
            await this.clientes.write(clientes);
            res.json({
                mensagem: 'Cliente atualizado com sucesso',
                cliente: clienteAtualizado
            });
        } catch (error) {
            res.status(500).json({ erro: 'Erro interno do servidor' });
        }
    }
    // DELETE /api/clientes/:id
    async excluir(req, res) {
        try {
            const clientes = await this.clientes.read();
            const index = clientes.findIndex(c => c.id === req.params.id);
            if (index === -1) {
                return res.status(404).json({ erro: 'Cliente não encontrado' });
            }
            const clienteExcluido = clientes.splice(index, 1)[0];
            await this.clientes.write(clientes);
            res.json({
                mensagem: 'Cliente excluído com sucesso',
                cliente: clienteExcluido
            });
        } catch (error) {
            res.status(500).json({ erro: 'Erro interno do servidor' });
        }
    }
    // GET /api/estados
    async listarEstados(req, res) {
        try {
            const estados = await this.estados.read();
            const estadosOrdenados = estados.sort((a, b) => a.Nome.localeCompare(b.Nome));
            res.json(estadosOrdenados);
        } catch (error) {
            res.status(500).json({ erro: 'Erro interno do servidor' });
        }
    }
    // GET /api/cidades/:estadoId
    async listarCidades(req, res) {
        try {
            const cidades = await this.cidades.read();
            const cidadesDoEstado = cidades.filter(c => c.Estado === req.params.estadoId);
            const cidadesOrdenadas = cidadesDoEstado.sort((a, b) => a.Nome.localeCompare(b.Nome));
            res.json(cidadesOrdenadas);
        } catch (error) {
            res.status(500).json({ erro: 'Erro interno do servidor' });
        }
    }
    // POST /api/renomear-imagem
    async renomearImagem(req, res) {
        try {
            const { idAntigo, novoId } = req.body;
            if (!idAntigo || !novoId) {
                return res.status(400).json({ erro: 'IDs são obrigatórios' });
            }
            const caminhoAntigo = path.join(__dirname, '..', '..', 'data', 'user_icon', `${idAntigo}.png`);
            const caminhoNovo = path.join(__dirname, '..', '..', 'data', 'user_icon', `${novoId}.png`);
            try {
                await fs.access(caminhoAntigo);
                await fs.rename(caminhoAntigo, caminhoNovo);
                res.json({ mensagem: 'Imagem renomeada com sucesso' });
            } catch (error) {
                if (error.code === 'ENOENT') {
                    res.json({ mensagem: 'Arquivo de imagem não encontrado, continuando...' });
                } else {
                    throw error;
                }
            }
        } catch (error) {
            res.status(500).json({ erro: 'Erro interno do servidor' });
        }
    }
    // POST /api/upload-imagem/:id (upload via multipart/form)
    async uploadImagem(req, res) {
        try {
            // A imagem já foi salva pelo multer, renomeia para <id>.png
            const id = req.params.id;
            if (!req.file) {
                return res.status(400).json({ erro: 'Nenhum arquivo enviado' });
            }
            const destino = path.join(req.file.destination, `${id}.png`);
            await fs.rename(req.file.path, destino);
            res.json({ mensagem: 'Imagem salva com sucesso' });
        } catch (error) {
            res.status(500).json({ erro: 'Erro ao salvar imagem' });
        }
    }
}

const controller = new ClienteController();

// Rotas de clientes
router.get('/clientes', (req, res) => controller.listar(req, res));
router.get('/clientes/:id', (req, res) => controller.buscarPorId(req, res));
router.post('/clientes', (req, res) => controller.criar(req, res));
router.put('/clientes/:id', (req, res) => controller.atualizar(req, res));
router.delete('/clientes/:id', (req, res) => controller.excluir(req, res));

// Rotas auxiliares
router.get('/estados', (req, res) => controller.listarEstados(req, res));
router.get('/cidades/:estadoId', (req, res) => controller.listarCidades(req, res));

// Upload de imagem
router.post('/upload-imagem/:id', upload.single('imagem'), (req, res) => controller.uploadImagem(req, res));

// Rota para renomeação de imagem
router.post('/renomear-imagem', (req, res) => controller.renomearImagem(req, res));

// Middleware de tratamento de erros
router.use((error, req, res, next) => {
    console.error('Erro não tratado:', error);
    res.status(500).json({ erro: 'Erro interno do servidor' });
});

module.exports = router;