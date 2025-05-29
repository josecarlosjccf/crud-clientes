const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const router = express.Router();

// Caminhos dos arquivos/diretórios de dados
const rootPath = path.join(__dirname, '../..');
const arquivoClientes = path.join(rootPath, 'data', 'lista_clientes.json');
const pastaUserIcon = path.join(rootPath, 'data', 'user_icon');

// Configuração do multer: aceita qualquer imagem até 15MB e preserva extensão original
const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        // Garante que o diretório de ícones existe
        await fs.mkdir(pastaUserIcon, { recursive: true });
        cb(null, pastaUserIcon);
    },
    filename: function (req, file, cb) {
        try {
            // Nomeia o arquivo com o id do cliente + extensão original
            const cliente = JSON.parse(req.body.cliente);
            const ext = path.extname(file.originalname) || '';
            cb(null, cliente.id + ext);
        } catch {
            cb(new Error('ID do cliente não encontrado para nomear imagem'));
        }
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 }, // Limite: 15 MB
    fileFilter: (req, file, cb) => {
        // Aceita apenas imagens de qualquer formato
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Arquivo não é uma imagem!'));
        }
    }
});

// Classe de serviço para manipular os clientes
class ClienteService {
    constructor(arquivo) {
        this.arquivo = arquivo;
        this.dataPath = path.dirname(arquivo);
    }
    // Garante que o diretório 'data' existe
    async garantirDiretorioData() {
        try {
            await fs.access(this.dataPath);
        } catch {
            await fs.mkdir(this.dataPath, { recursive: true });
        }
    }
    // Lê o arquivo de clientes
    async lerClientes() {
        try {
            const dados = await fs.readFile(this.arquivo, 'utf8');
            const clientes = JSON.parse(dados);
            return Array.isArray(clientes) ? clientes : [];
        } catch {
            return [];
        }
    }
    // Salva o array de clientes no arquivo
    async salvarClientes(clientes) {
        await this.garantirDiretorioData();
        await fs.writeFile(this.arquivo, JSON.stringify(clientes, null, 2), 'utf8');
    }
}

const clienteService = new ClienteService(arquivoClientes);

// GET - Lista todos os clientes
router.get('/', async (req, res) => {
    try {
        const clientes = await clienteService.lerClientes();
        res.json(clientes);
    } catch (erro) {
        console.error('Erro ao listar clientes:', erro);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// POST - Adiciona novo cliente (com upload de imagem opcional)
router.post('/', upload.single('userIcon'), async (req, res) => {
    try {
        const novoCliente = JSON.parse(req.body.cliente);

        // Valida campos obrigatórios
        if (!novoCliente.id || !novoCliente.codigoFiscal || !novoCliente.nome) {
            return res.status(400).json({ 
                erro: 'Dados obrigatórios não fornecidos',
                detalhes: 'ID, código fiscal e nome são obrigatórios' 
            });
        }

        const clientes = await clienteService.lerClientes();

        // Valida duplicidades
        const validacoes = [
            {
                teste: clientes.some(c => c.id === novoCliente.id),
                msg: 'ID já existe no sistema!'
            },
            {
                teste: clientes.some(c => c.codigoFiscal === novoCliente.codigoFiscal),
                msg: `${novoCliente.tipo === 'pj' ? 'CNPJ' : 'CPF'} já cadastrado!`
            },
            {
                teste: novoCliente.tipo === 'pj' && novoCliente.inscricaoEstadual && 
                       clientes.some(c => c.inscricaoEstadual === novoCliente.inscricaoEstadual),
                msg: 'Inscrição Estadual já cadastrada!'
            }
        ];

        for (const validacao of validacoes) {
            if (validacao.teste) {
                return res.status(409).json({ erro: validacao.msg });
            }
        }

        // Adiciona caminho da imagem, se houver upload
        if (req.file) {
            novoCliente.userIconPath = path.join('data', 'user_icon', req.file.filename).replace(/\\/g, '/');
        } else {
            novoCliente.userIconPath = '';
        }

        // Adiciona data de cadastro se não existir
        if (!novoCliente.dataCadastro) {
            novoCliente.dataCadastro = new Date().toISOString();
        }

        // Salva novo cliente
        clientes.push(novoCliente);
        await clienteService.salvarClientes(clientes);

        res.status(201).json({ 
            sucesso: true, 
            mensagem: 'Cliente cadastrado com sucesso!',
            cliente: novoCliente 
        });
    } catch (erro) {
        // Erro de multer: tipo ou tamanho de imagem
        if (erro instanceof multer.MulterError || erro.message.includes('imagem')) {
            return res.status(400).json({ erro: erro.message });
        }
        console.error('Erro ao cadastrar cliente:', erro);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// GET - Busca cliente por ID
router.get('/:id', async (req, res) => {
    try {
        const clientes = await clienteService.lerClientes();
        const cliente = clientes.find(c => c.id === req.params.id);
        if (!cliente) {
            return res.status(404).json({ erro: 'Cliente não encontrado' });
        }
        res.json(cliente);
    } catch (erro) {
        console.error('Erro ao buscar cliente:', erro);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// PUT - Atualiza cliente (suporta atualizar imagem)
router.put('/:id', upload.single('userIcon'), async (req, res) => {
    try {
        const clientes = await clienteService.lerClientes();
        const indice = clientes.findIndex(c => c.id === req.params.id);

        if (indice === -1) {
            return res.status(404).json({ erro: 'Cliente não encontrado' });
        }

        // Atualiza dados do cliente
        let clienteAtualizado;
        if (req.body.cliente) {
            clienteAtualizado = JSON.parse(req.body.cliente);
        } else {
            clienteAtualizado = req.body;
        }

        // Atualiza caminho da imagem se houver novo upload
        if (req.file) {
            clienteAtualizado.userIconPath = path.join('data', 'user_icon', req.file.filename).replace(/\\/g, '/');
        } else {
            clienteAtualizado.userIconPath = clientes[indice].userIconPath || '';
        }

        // Mantém data de cadastro e adiciona data de atualização
        clienteAtualizado.dataCadastro = clientes[indice].dataCadastro;
        clienteAtualizado.dataAtualizacao = new Date().toISOString();

        clientes[indice] = clienteAtualizado;
        await clienteService.salvarClientes(clientes);

        res.json({ 
            sucesso: true, 
            mensagem: 'Cliente atualizado com sucesso!',
            cliente: clienteAtualizado 
        });
    } catch (erro) {
        if (erro instanceof multer.MulterError || erro.message.includes('imagem')) {
            return res.status(400).json({ erro: erro.message });
        }
        console.error('Erro ao atualizar cliente:', erro);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// DELETE - Remove cliente e apaga imagem do disco se existir
router.delete('/:id', async (req, res) => {
    try {
        const clientes = await clienteService.lerClientes();
        const indice = clientes.findIndex(c => c.id === req.params.id);

        if (indice === -1) {
            return res.status(404).json({ erro: 'Cliente não encontrado' });
        }

        const clienteRemovido = clientes.splice(indice, 1)[0];
        await clienteService.salvarClientes(clientes);

        // Remove arquivo de imagem, se existir
        if (clienteRemovido.userIconPath) {
            try {
                await fs.unlink(path.join(rootPath, clienteRemovido.userIconPath));
            } catch {}
        }

        res.json({ 
            sucesso: true, 
            mensagem: 'Cliente removido com sucesso!',
            cliente: clienteRemovido 
        });
    } catch (erro) {
        console.error('Erro ao remover cliente:', erro);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

module.exports = router;