const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class EditarUsuarioController {
    constructor() {
        this.router = express.Router();
        this.setupRoutes();
        this.findUsersFile();
    }

    findUsersFile() {
        const fs2 = require('fs');
        const possiblePaths = [
            path.join(__dirname, '../../data/users.json'),
            path.join(__dirname, '../data/users.json'),
            path.join(__dirname, '../../../data/users.json'),
            path.join(process.cwd(), 'data/users.json'),
            path.join(__dirname, '../../', 'data', 'users.json')
        ];

        console.log('Diretório atual (__dirname):', __dirname);
        console.log('Diretório de trabalho (cwd):', process.cwd());
        console.log('Testando caminhos possíveis:');

        for (const caminho of possiblePaths) {
            console.log(`Testando: ${caminho}`);
            if (fs2.existsSync(caminho)) {
                console.log(`✓ ENCONTRADO: ${caminho}`);
                this.usersFilePath = caminho;
                return;
            } else {
                console.log(`✗ Não existe: ${caminho}`);
            }
        }

        console.log('❌ Arquivo users.json não encontrado em nenhum dos caminhos testados');
        this.usersFilePath = path.join(process.cwd(), 'data/users.json'); // fallback
    }

    setupRoutes() {
        this.router.put('/', (req, res) => this.editarUsuario(req, res));
        this.router.get('/', (req, res) => this.buscarUsuarioMaisRecente(req, res));
    }

    async buscarUsuarioMaisRecente(req, res) {
        try {
            const usuarios = await this.carregarUsuarios();
            
            if (usuarios.length === 0) {
                return res.status(404).json({
                    erro: 'Nenhum usuário encontrado'
                });
            }

            // Encontra o usuário com a data de cadastro mais recente
            const usuarioMaisRecente = usuarios.reduce((mais_recente, atual) => {
                const dataAtual = new Date(atual.dataCadastro);
                const dataMaisRecente = new Date(mais_recente.dataCadastro);
                return dataAtual > dataMaisRecente ? atual : mais_recente;
            });

            res.json({
                sucesso: true,
                usuario: usuarioMaisRecente
            });

        } catch (error) {
            console.error('Erro ao buscar usuário mais recente:', error);
            res.status(500).json({
                erro: 'Erro interno do servidor ao buscar usuário'
            });
        }
    }

    async editarUsuario(req, res) {
        try {
            const { id, nome, email, senha } = req.body;

            // Validações básicas
            if (!id || !nome || !email || !senha) {
                return res.status(400).json({
                    erro: 'Todos os campos são obrigatórios'
                });
            }

            // Validação de email
            if (!this.isValidEmail(email)) {
                return res.status(400).json({
                    erro: 'Email inválido'
                });
            }

            // Carrega usuários existentes
            const usuarios = await this.carregarUsuarios();
            
            // Encontra o usuário pelo ID
            const indexUsuario = usuarios.findIndex(user => user.id === id);
            
            if (indexUsuario === -1) {
                return res.status(404).json({
                    erro: 'Usuário não encontrado'
                });
            }

            // Verifica se o email já existe em outro usuário
            const emailExiste = usuarios.some(user => user.email === email && user.id !== id);
            if (emailExiste) {
                return res.status(400).json({
                    erro: 'Este email já está sendo usado por outro usuário'
                });
            }

            // Atualiza os dados do usuário
            const usuarioAtual = usuarios[indexUsuario];
            const senhaHash = this.isSenhaHash(senha) ? senha : this.criptografarSenha(senha);
            
            usuarios[indexUsuario] = {
                ...usuarioAtual,
                nome: nome.trim(),
                email: email.toLowerCase().trim(),
                senha: senhaHash
            };

            // Salva no arquivo
            await this.salvarUsuarios(usuarios);

            res.json({
                sucesso: true,
                mensagem: 'Usuário atualizado com sucesso',
                usuario: {
                    id: usuarios[indexUsuario].id,
                    nome: usuarios[indexUsuario].nome,
                    email: usuarios[indexUsuario].email,
                    senha: usuarios[indexUsuario].senha,
                    dataCadastro: usuarios[indexUsuario].dataCadastro
                }
            });

        } catch (error) {
            console.error('Erro ao editar usuário:', error);
            res.status(500).json({
                erro: 'Erro interno do servidor'
            });
        }
    }

    async carregarUsuarios() {
        try {
            console.log('Carregando usuários do arquivo:', this.usersFilePath);
            
            const fs2 = require('fs');
            if (!fs2.existsSync(this.usersFilePath)) {
                console.log('❌ Arquivo não existe no momento da leitura:', this.usersFilePath);
                return [];
            }
            
            const data = await fs.readFile(this.usersFilePath, 'utf8');
            console.log('✓ Arquivo lido com sucesso');
            console.log('Conteúdo bruto:', data.substring(0, 200) + '...');
            
            const usuarios = JSON.parse(data);
            console.log('✓ JSON parseado com sucesso');
            console.log('Número de usuários encontrados:', usuarios.length);
            
            if (usuarios.length > 0) {
                console.log('Primeiro usuário:', {
                    id: usuarios[0].id,
                    nome: usuarios[0].nome,
                    email: usuarios[0].email,
                    dataCadastro: usuarios[0].dataCadastro
                });
            }
            
            return usuarios;
        } catch (error) {
            console.error('❌ Erro ao carregar usuários:', error.message);
            console.error('Tipo de erro:', error.code);
            if (error.code === 'ENOENT') {
                console.log('Retornando array vazio devido ao arquivo não encontrado');
                return [];
            }
            throw error;
        }
    }

    async salvarUsuarios(usuarios) {
        await fs.writeFile(this.usersFilePath, JSON.stringify(usuarios, null, 2));
    }

    criptografarSenha(senha) {
        return crypto.createHash('sha256').update(senha).digest('hex');
    }

    isSenhaHash(senha) {
        // Verifica se a senha já é um hash SHA256 (64 caracteres hexadecimais)
        return /^[a-f0-9]{64}$/i.test(senha);
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    getRouter() {
        return this.router;
    }
}

// Exporta a instância do router
module.exports = new EditarUsuarioController().getRouter();