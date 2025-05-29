const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class LoginController {
  constructor() {
    this.usersFile = path.join(__dirname, '../../data/users.json');
    this.router = express.Router();
    this.router.post('/', this.login.bind(this));
  }

  /**
   * Criptografa senha usando SHA-256
   * @param {string} senha - Senha em texto plano
   * @returns {string} - Hash SHA-256 da senha
   */
  criptografarSenha(senha) {
    return crypto.createHash('sha256').update(senha).digest('hex');
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios' });
      }

      const data = await fs.promises.readFile(this.usersFile, 'utf-8');
      const users = JSON.parse(data);

      const user = users.find(u => u.email === email);
      if (!user) {
        return res.status(401).json({ error: 'Usuário não encontrado' });
      }

      // Criptografa a senha fornecida e compara com a senha armazenada
      const senhaCriptografada = this.criptografarSenha(password);

      if (senhaCriptografada !== user.senha) {
        return res.status(401).json({ error: 'Senha incorreta' });
      }

      return res.status(200).json({ message: 'Login realizado com sucesso' });
    } catch (error) {
      console.error('Erro no login:', error);
      return res.status(500).json({ error: 'Erro interno no servidor' });
    }
  }
}

module.exports = new LoginController().router;