const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const router = express.Router();

// Configuração de caminhos
const rootPath = path.join(__dirname, '../..');
const arquivoClientes = path.join(rootPath, 'data', 'lista_clientes.json');
const pastaUserIcon = path.join(rootPath, 'data', 'user_icon');

// Configuração do multer para upload de imagens
const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        await fs.mkdir(pastaUserIcon, { recursive: true });
        cb(null, pastaUserIcon);
    },
    filename: function (req, file, cb) {
        try {
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
    limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Arquivo não é uma imagem!'));
        }
    }
});

/**
 * Classe de serviço para gerenciar operações com clientes
 * Controla a leitura/escrita do arquivo JSON e validações
 */
class ClienteService {
    constructor(arquivo) {
        this.arquivo = arquivo;
        this.dataPath = path.dirname(arquivo);
    }

    async garantirDiretorioData() {
        try {
            await fs.access(this.dataPath);
        } catch {
            await fs.mkdir(this.dataPath, { recursive: true });
        }
    }

    async lerClientes() {
        try {
            const dados = await fs.readFile(this.arquivo, 'utf8');
            const clientes = JSON.parse(dados);
            return Array.isArray(clientes) ? clientes : [];
        } catch {
            return [];
        }
    }

    async salvarClientes(clientes) {
        await this.garantirDiretorioData();
        await fs.writeFile(this.arquivo, JSON.stringify(clientes, null, 2), 'utf8');
    }

    /**
     * Valida se já existe cliente com o mesmo código fiscal
     * Para PF: verifica CPF
     * Para PJ: verifica CNPJ e Inscrição Estadual
     */
    validarDuplicidade(clientes, novoCliente) {
        const validacoes = [
            {
                teste: clientes.some(c => c.id === novoCliente.id),
                mensagem: 'ID já existe no sistema!'
            },
            {
                teste: clientes.some(c => c.codigoFiscal === novoCliente.codigoFiscal),
                mensagem: `${novoCliente.tipo === 'pj' ? 'CNPJ' : 'CPF'} já cadastrado!`
            }
        ];

        // Para PJ, valida também Inscrição Estadual
        if (novoCliente.tipo === 'pj' && novoCliente.inscricaoEstadual) {
            validacoes.push({
                teste: clientes.some(c => 
                    c.tipo === 'pj' && 
                    c.inscricaoEstadual && 
                    c.inscricaoEstadual === novoCliente.inscricaoEstadual
                ),
                mensagem: 'Inscrição Estadual já cadastrada!'
            });
        }

        return validacoes;
    }

    /**
     * Valida campos obrigatórios do cliente
     */
    validarCamposObrigatorios(cliente) {
        const camposObrigatorios = ['id', 'codigoFiscal', 'nome'];
        const camposFaltando = camposObrigatorios.filter(campo => !cliente[campo]);
        
        if (camposFaltando.length > 0) {
            return {
                valido: false,
                mensagem: `Campos obrigatórios não preenchidos: ${camposFaltando.join(', ')}`
            };
        }
        
        return { valido: true };
    }
}

const clienteService = new ClienteService(arquivoClientes);

/**
 * GET - Lista todos os clientes cadastrados
 */
router.get('/', async (req, res) => {
    try {
        const clientes = await clienteService.lerClientes();
        res.json(clientes);
    } catch (erro) {
        console.error('Erro ao listar clientes:', erro);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

/**
 * POST - Cadastra novo cliente com validação completa de duplicidade
 * Valida CPF/CNPJ e Inscrição Estadual antes de salvar
 */
router.post('/', upload.single('userIcon'), async (req, res) => {
    try {
        const novoCliente = JSON.parse(req.body.cliente);

        // Valida campos obrigatórios
        const validacaoObrigatorios = clienteService.validarCamposObrigatorios(novoCliente);
        if (!validacaoObrigatorios.valido) {
            return res.status(400).json({ 
                erro: validacaoObrigatorios.mensagem,
                detalhes: 'Verifique se todos os campos obrigatórios foram preenchidos'
            });
        }

        // Carrega clientes existentes para validação
        const clientes = await clienteService.lerClientes();

        // Executa validações de duplicidade
        const validacoes = clienteService.validarDuplicidade(clientes, novoCliente);
        
        for (const validacao of validacoes) {
            if (validacao.teste) {
                return res.status(409).json({ 
                    erro: validacao.mensagem,
                    detalhes: 'Cliente com esses dados já existe no sistema'
                });
            }
        }

        // Adiciona caminho da imagem se foi feito upload
        if (req.file) {
            novoCliente.userIconPath = path.join('data', 'user_icon', req.file.filename).replace(/\\/g, '/');
        } else {
            novoCliente.userIconPath = '';
        }

        // Adiciona timestamp de cadastro
        if (!novoCliente.dataCadastro) {
            novoCliente.dataCadastro = new Date().toISOString();
        }

        // Salva o novo cliente
        clientes.push(novoCliente);
        await clienteService.salvarClientes(clientes);

        res.status(201).json({ 
            sucesso: true, 
            mensagem: 'Cliente cadastrado com sucesso!',
            cliente: novoCliente 
        });

    } catch (erro) {
        // Tratamento de erros específicos do multer
        if (erro instanceof multer.MulterError) {
            if (erro.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ erro: 'Arquivo muito grande! Máximo 15MB.' });
            }
            return res.status(400).json({ erro: erro.message });
        }
        
        if (erro.message.includes('imagem')) {
            return res.status(400).json({ erro: erro.message });
        }
        
        console.error('Erro ao cadastrar cliente:', erro);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

/**
 * GET - Busca cliente específico por ID
 */
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

/**
 * PUT - Atualiza cliente existente com validação de duplicidade
 */
router.put('/:id', upload.single('userIcon'), async (req, res) => {
    try {
        const clientes = await clienteService.lerClientes();
        const indice = clientes.findIndex(c => c.id === req.params.id);

        if (indice === -1) {
            return res.status(404).json({ erro: 'Cliente não encontrado' });
        }

        let clienteAtualizado;
        if (req.body.cliente) {
            clienteAtualizado = JSON.parse(req.body.cliente);
        } else {
            clienteAtualizado = req.body;
        }

        // Valida duplicidade excluindo o próprio cliente
        const outrosClientes = clientes.filter((_, i) => i !== indice);
        const validacoes = clienteService.validarDuplicidade(outrosClientes, clienteAtualizado);
        
        for (const validacao of validacoes) {
            if (validacao.teste) {
                return res.status(409).json({ 
                    erro: validacao.mensagem,
                    detalhes: 'Já existe outro cliente com esses dados'
                });
            }
        }

        // Atualiza caminho da imagem se houver novo upload
        if (req.file) {
            clienteAtualizado.userIconPath = path.join('data', 'user_icon', req.file.filename).replace(/\\/g, '/');
        } else {
            clienteAtualizado.userIconPath = clientes[indice].userIconPath || '';
        }

        // Preserva data de cadastro e adiciona data de atualização
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

/**
 * DELETE - Remove cliente e sua imagem do sistema
 */
router.delete('/:id', async (req, res) => {
    try {
        const clientes = await clienteService.lerClientes();
        const indice = clientes.findIndex(c => c.id === req.params.id);

        if (indice === -1) {
            return res.status(404).json({ erro: 'Cliente não encontrado' });
        }

        const clienteRemovido = clientes.splice(indice, 1)[0];
        await clienteService.salvarClientes(clientes);

        // Remove arquivo de imagem se existir
        if (clienteRemovido.userIconPath) {
            try {
                await fs.unlink(path.join(rootPath, clienteRemovido.userIconPath));
            } catch (erroImagem) {
                console.log('Imagem não encontrada ou já removida:', erroImagem.message);
            }
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