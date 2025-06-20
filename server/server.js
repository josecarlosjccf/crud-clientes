const express = require('express');
const path = require('path');

// Classe principal do servidor
class Server {
    constructor(port = 3000) {
        this.app = express();
        this.port = port;
        this.rootPath = path.join(__dirname, '..'); // raiz do projeto
        this.serverPath = __dirname;                // pasta server

        this.middlewares();
        this.routes();
        this.errorHandler();
    }

    // Middlewares globais
    middlewares() {
        // Serve arquivos estáticos da raiz (HTML, CSS, assets, etc)
        this.app.use(express.static(this.rootPath));
        // Serve arquivos estáticos da pasta server (scripts, etc)
        this.app.use(express.static(this.serverPath));
        // Permite JSON no body
        this.app.use(express.json());
    }

    // Define rotas da API e das páginas HTML
    routes() {
        // Rotas da API
        this.app.use('/api/clientes', require('./routes/clientes'));
        this.app.use('/api/cadastro', require('./routes/cadastro'));
        this.app.use('/api/login', require('./routes/login'));
        this.app.use('/api/lista', require('./routes/lista'));
        
        // Rota de edição de usuário (inclui tanto PUT /api/editar quanto GET /api/usuario-atual)
        const editarRoutes = require('./routes/editar');
        this.app.use('/api/editar', editarRoutes);
        this.app.use('/api/usuario-atual', editarRoutes);

        // Rotas para páginas HTML na raiz
        this.app.get('/', (req, res) => res.sendFile(path.join(this.rootPath, 'index.html')));
        this.app.get('/cadastro', (req, res) => res.sendFile(path.join(this.rootPath, 'cadastro_user.html')));
        this.app.get('/cliente', (req, res) => res.sendFile(path.join(this.rootPath, 'form_cliente.html')));
        this.app.get('/lista', (req, res) => res.sendFile(path.join(this.rootPath, 'lista_clientes.html')));
        this.app.get('/editar-usuario', (req, res) => res.sendFile(path.join(this.rootPath, 'editar_usuario.html')));
    }

    // Middleware de tratamento de erros
    errorHandler() {
        this.app.use((err, req, res, next) => {
            console.error('Erro não tratado:', err);
            res.status(500).json({ erro: 'Erro interno do servidor' });
        });
    }

    // Inicia o servidor na porta definida
    start() {
        this.app.listen(this.port, () => {
            console.log(`Servidor rodando em http://localhost:${this.port}`);
            console.log(`Diretório raiz: ${this.rootPath}`);
        });
    }
}

// Inicialização do servidor
new Server().start();