const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const router = express.Router();

// Classe para gerenciar usuários e validação
class UsuarioManager {
  constructor() {
    // Caminho para o arquivo de dados
    this.dataPath = path.join(__dirname, '../../data/users.json');
    // Garante que o diretório data existe
    this.garantirDiretorio();
  }

  /**
   * Garante que o diretório data existe
   */
  garantirDiretorio() {
    const dataDir = path.dirname(this.dataPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  /**
   * Carrega usuários do arquivo JSON
   * @returns {Array} - Array de usuários
   */
  carregarUsuarios() {
    try {
      if (fs.existsSync(this.dataPath)) {
        const data = fs.readFileSync(this.dataPath, 'utf8');
        return JSON.parse(data);
      }
      return [];
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      return [];
    }
  }

  /**
   * Salva usuários no arquivo JSON
   * @param {Array} usuarios - Array de usuários para salvar
   */
  salvarUsuarios(usuarios) {
    try {
      fs.writeFileSync(this.dataPath, JSON.stringify(usuarios, null, 2), 'utf8');
    } catch (error) {
      console.error('Erro ao salvar usuários:', error);
      throw new Error('Erro ao salvar dados');
    }
  }

  /**
   * Criptografa senha usando SHA-256
   * @param {string} senha - Senha em texto plano
   * @returns {string} - Hash SHA-256 da senha
   */
  criptografarSenha(senha) {
    return crypto.createHash('sha256').update(senha).digest('hex');
  }

  /**
   * Valida se o objeto usuário tem todos os campos necessários
   * @param {Object} usuario - Objeto usuário
   * @returns {boolean} - true se válido, false se falta algum campo
   */
  validarUsuario(usuario) {
    return usuario.nome && usuario.email && usuario.senha;
  }

  /**
   * Verifica se já existe um usuário com o mesmo email
   * @param {string} email - Email para checar duplicidade
   * @returns {boolean} - true se já existe, false se não
   */
  emailExiste(email) {
    const usuarios = this.carregarUsuarios();
    return usuarios.some(u => u.email === email);
  }

  /**
   * Adiciona um novo usuário
   * @param {Object} usuario - Objeto usuário
   * @returns {Object} - Usuário adicionado
   */
  adicionarUsuario(usuario) {
    const usuarios = this.carregarUsuarios();
    
    // Criptografa a senha antes de salvar
    const novoUsuario = {
      id: Date.now(), // ID simples baseado em timestamp
      nome: usuario.nome,
      email: usuario.email,
      senha: this.criptografarSenha(usuario.senha),
      dataCadastro: new Date().toISOString()
    };

    usuarios.push(novoUsuario);
    this.salvarUsuarios(usuarios);
    
    return novoUsuario;
  }
}

// Instância para gerenciar os usuários
const usuarioManager = new UsuarioManager();

// Rota POST para cadastrar usuários
router.post('/usuarios', (req, res) => {
  
  try {
    const { nome, email, senha } = req.body;

    // Validação dos dados recebidos
    if (!usuarioManager.validarUsuario(req.body)) {
      return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });
    }

    // Verifica se email já está cadastrado
    if (usuarioManager.emailExiste(email)) {
      return res.status(409).json({ erro: 'Email já cadastrado' });
    }

    // Adiciona usuário ao arquivo JSON
    const novoUsuário = usuarioManager.adicionarUsuario({ nome, email, senha });

    // Retorna sucesso (sem expor a senha)
    return res.status(201).json({ 
      mensagem: 'Usuário cadastrado com sucesso!',
      usuario: {
        id: novoUsuário.id,
        nome: novoUsuário.nome,
        email: novoUsuário.email,
        dataCadastro: novoUsuário.dataCadastro
      }
    });

  } catch (error) {
    return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

module.exports = router;