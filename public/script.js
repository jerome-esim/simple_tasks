class TaskManager {
    constructor() {
        this.currentProjectId = null;
        this.categories = [];
        this.tasks = [];
        this.init();
    }

    init() {
        this.loadProjects();
        this.bindEvents();
        this.updateWelcomeVisibility();
    }

    bindEvents() {
        // Sélection de projet
        document.getElementById('projectSelect').addEventListener('change', (e) => {
            this.currentProjectId = e.target.value;
            if (this.currentProjectId) {
                this.loadProject(this.currentProjectId);
            } else {
                this.showWelcome();
            }
        });

        // Boutons modales
        document.getElementById('newProjectBtn').addEventListener('click', () => {
            this.openModal('projectModal');
        });

        document.getElementById('newCategoryBtn').addEventListener('click', () => {
            this.openModal('categoryModal');
        });

        document.getElementById('newTaskBtn').addEventListener('click', () => {
            this.openTaskModal();
        });

        // Formulaires
        document.getElementById('projectForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createProject();
        });

        document.getElementById('categoryForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createCategory();
        });

        document.getElementById('taskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveTask();
        });

        // Filtres
        document.getElementById('categoryFilter').addEventListener('change', () => {
            this.renderTasks();
        });

        document.getElementById('statusFilter').addEventListener('change', () => {
            this.renderTasks();
        });

        // Fermeture modales
        document.querySelectorAll('.close').forEach(close => {
            close.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });

        // Suppression de tâche
        document.getElementById('deleteTaskBtn').addEventListener('click', () => {
            this.deleteTask();
        });

        // Fermeture modal au clic extérieur
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }

async loadProjects() {
    try {
        const response = await fetch(`./api/projects`);
        if (!response.ok) throw new Error('Erreur réseau');
        
        const projects = await response.json();
        
        const select = document.getElementById('projectSelect');
        select.innerHTML = '<option value="">Sélectionner un projet...</option>';
        
        let firstNonDemoProject = null;
        
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            select.appendChild(option);
            
            // ✅ Trouver le premier projet qui n'est pas "demo"
            if (!firstNonDemoProject && 
                !project.name.toLowerCase().includes('demo') && 
                !project.name.toLowerCase().includes('exemple')) {
                firstNonDemoProject = project;
            }
        });

        // ✅ Sélectionner automatiquement le premier projet non-demo
        if (firstNonDemoProject) {
            select.value = firstNonDemoProject.id;
            this.currentProjectId = firstNonDemoProject.id;
            this.loadProject(firstNonDemoProject.id);
        } else if (projects.length > 0) {
            // Fallback: sélectionner le premier projet s'il n'y en a qu'un
            select.value = projects[0].id;
            this.currentProjectId = projects[0].id;
            this.loadProject(projects[0].id);
        } else {
            this.updateWelcomeVisibility();
        }

    } catch (error) {
        console.error('Erreur lors du chargement des projets:', error);
        this.showError('Impossible de charger les projets');
    }
}

    async loadProject(projectId) {
        try {
            // Charger les catégories
            const categoriesResponse = await fetch(`./api/categories/${projectId}`);
            if (!categoriesResponse.ok) throw new Error('Erreur catégories');
            this.categories = await categoriesResponse.json();

            // Charger les tâches
            const tasksResponse = await fetch(`./api/tasks/${projectId}`);
            if (!tasksResponse.ok) throw new Error('Erreur tâches');
            this.tasks = await tasksResponse.json();

            // Afficher le projet
            const project = document.getElementById('projectSelect').selectedOptions[0].textContent;
            document.getElementById('projectTitle').textContent = project;
            this.showProject();

            this.populateFilters();
            this.renderTasks();
        } catch (error) {
            console.error('Erreur lors du chargement du projet:', error);
            this.showError('Impossible de charger le projet');
        }
    }

    showProject() {
        document.getElementById('projectView').style.display = 'block';
        document.getElementById('welcomeMessage').style.display = 'none';
    }

    showWelcome() {
        document.getElementById('projectView').style.display = 'none';
        document.getElementById('welcomeMessage').style.display = 'block';
    }

    updateWelcomeVisibility() {
        if (!this.currentProjectId) {
            this.showWelcome();
        }
    }

    populateFilters() {
        const categoryFilter = document.getElementById('categoryFilter');
        const taskCategory = document.getElementById('taskCategory');
        
        categoryFilter.innerHTML = '<option value="">Toutes les catégories</option>';
        taskCategory.innerHTML = '<option value="">Aucune catégorie</option>';
        
        this.categories.forEach(category => {
            const option1 = document.createElement('option');
            option1.value = category.id;
            option1.textContent = category.name;
            categoryFilter.appendChild(option1);

            const option2 = document.createElement('option');
            option2.value = category.id;
            option2.textContent = category.name;
            taskCategory.appendChild(option2);
        });
    }

    renderTasks() {
        const container = document.getElementById('tasksContainer');
        const categoryFilter = document.getElementById('categoryFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;

        let filteredTasks = this.tasks;

        if (categoryFilter) {
            filteredTasks = filteredTasks.filter(task => task.category_id == categoryFilter);
        }

        if (statusFilter) {
            filteredTasks = filteredTasks.filter(task => task.status === statusFilter);
        }

        // Mettre à jour les statistiques
        this.updateStats(filteredTasks);

        if (filteredTasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>📭 Aucune tâche trouvée</h3>
                    <p>Créez votre première tâche pour commencer !</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredTasks.map(task => this.renderTaskCard(task)).join('');

        // Ajouter les événements de clic
        container.querySelectorAll('.task-card').forEach(card => {
            card.addEventListener('click', () => {
                const taskId = card.dataset.taskId;
                this.openTaskModal(taskId);
            });
        });
    }

    updateStats(tasks) {
        const statsEl = document.getElementById('taskStats');
        const total = tasks.length;
        const done = tasks.filter(t => t.status === 'done').length;
        const inProgress = tasks.filter(t => t.status === 'in_progress').length;
        const todo = tasks.filter(t => t.status === 'todo').length;

        statsEl.innerHTML = `
            📊 ${total} tâche(s) | 
            ✅ ${done} terminée(s) | 
            ⚡ ${inProgress} en cours | 
            📋 ${todo} à faire
        `;
    }

    renderTaskCard(task) {
        const deadlineClass = this.getDeadlineClass(task.deadline);
        const statusClass = `status-${task.status}`;
        const statusText = {
            'todo': '📋 À faire',
            'in_progress': '⚡ En cours',
            'done': '✅ Terminé'
        }[task.status];

        return `
            <div class="task-card" data-task-id="${task.id}" style="border-left-color: ${task.category_color || '#007bff'}">
                <div class="task-header">
                    <div class="task-title">${this.escapeHtml(task.title)}</div>
                    <div class="task-status ${statusClass}">${statusText}</div>
                </div>
                ${task.description ? `<div class="task-description">${this.escapeHtml(task.description)}</div>` : ''}
                <div class="task-meta">
                    <div class="task-meta-left">
                        ${task.category_name ? `<span class="task-category" style="background-color: ${task.category_color}">🏷️ ${this.escapeHtml(task.category_name)}</span>` : ''}
                        ${task.assigned_to ? `<div class="task-assigned">👤 ${this.escapeHtml(task.assigned_to)}</div>` : ''}
                    </div>
                    <div class="task-deadline ${deadlineClass}">
                        ${task.deadline ? `📅 ${this.formatDate(task.deadline)}` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    getDeadlineClass(deadline) {
        if (!deadline) return '';
        
        const today = new Date();
        const deadlineDate = new Date(deadline);
        const diffTime = deadlineDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return 'deadline-overdue';
        if (diffDays <= 3) return 'deadline-soon';
        return '';
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    openModal(modalId) {
        document.getElementById(modalId).style.display = 'block';
    }

    openTaskModal(taskId = null) {
        const modal = document.getElementById('taskModal');
        const form = document.getElementById('taskForm');
        const deleteBtn = document.getElementById('deleteTaskBtn');
        
        form.reset();
        
        if (taskId) {
            const task = this.tasks.find(t => t.id == taskId);
            if (task) {
                document.getElementById('taskId').value = task.id;
                document.getElementById('taskTitle').value = task.title;
                document.getElementById('taskDescription').value = task.description || '';
                document.getElementById('taskDeadline').value = task.deadline || '';
                document.getElementById('taskAssignedTo').value = task.assigned_to || '';
                document.getElementById('taskCategory').value = task.category_id || '';
                document.getElementById('taskStatus').value = task.status;
                document.getElementById('taskModalTitle').textContent = '✏️ Modifier la Tâche';
                deleteBtn.style.display = 'block';
            }
        } else {
            document.getElementById('taskModalTitle').textContent = '✅ Nouvelle Tâche';
            deleteBtn.style.display = 'none';
        }
        
        this.openModal('taskModal');
    }

    async createProject() {
        const name = document.getElementById('projectName').value.trim();
        const description = document.getElementById('projectDescription').value.trim();

        if (!name) {
            this.showError('Le nom du projet est requis');
            return;
        }

        try {
            const response = await fetch('./api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description })
            });

            if (!response.ok) throw new Error('Erreur création projet');

            document.getElementById('projectModal').style.display = 'none';
            document.getElementById('projectForm').reset();
            await this.loadProjects();
            this.showSuccess('Projet créé avec succès !');
        } catch (error) {
            console.error('Erreur lors de la création du projet:', error);
            this.showError('Impossible de créer le projet');
        }
    }

    async createCategory() {
        const name = document.getElementById('categoryName').value.trim();
        const color = document.getElementById('categoryColor').value;

        if (!name) {
            this.showError('Le nom de la catégorie est requis');
            return;
        }

        try {
            const response = await fetch('./api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, color, project_id: this.currentProjectId })
            });

            if (!response.ok) throw new Error('Erreur création catégorie');

            document.getElementById('categoryModal').style.display = 'none';
            document.getElementById('categoryForm').reset();
            await this.loadProject(this.currentProjectId);
            this.showSuccess('Catégorie créée avec succès !');
        } catch (error) {
            console.error('Erreur lors de la création de la catégorie:', error);
            this.showError('Impossible de créer la catégorie');
        }
    }

    async saveTask() {
        const taskId = document.getElementById('taskId').value;
        const title = document.getElementById('taskTitle').value.trim();
        
        if (!title) {
            this.showError('Le titre de la tâche est requis');
            return;
        }

        const taskData = {
            title,
            description: document.getElementById('taskDescription').value.trim(),
            deadline: document.getElementById('taskDeadline').value,
            assigned_to: document.getElementById('taskAssignedTo').value.trim(),
            category_id: document.getElementById('taskCategory').value || null,
            status: document.getElementById('taskStatus').value,
            project_id: this.currentProjectId
        };

        try {
            const url = taskId ? `./api/tasks/${taskId}` : './api/tasks';
            const method = taskId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            });

            if (!response.ok) throw new Error('Erreur sauvegarde tâche');

            document.getElementById('taskModal').style.display = 'none';
            await this.loadProject(this.currentProjectId);
            this.showSuccess(taskId ? 'Tâche modifiée !' : 'Tâche créée !');
        } catch (error) {
            console.error('Erreur lors de la sauvegarde de la tâche:', error);
            this.showError('Impossible de sauvegarder la tâche');
        }
    }

    async deleteTask() {
        const taskId = document.getElementById('taskId').value;
        
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette tâche ?')) {
            return;
        }

        try {
            const response = await fetch(`./api/tasks/${taskId}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Erreur suppression');

            document.getElementById('taskModal').style.display = 'none';
            await this.loadProject(this.currentProjectId);
            this.showSuccess('Tâche supprimée !');
        } catch (error) {
            console.error('Erreur lors de la suppression de la tâche:', error);
            this.showError('Impossible de supprimer la tâche');
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        // Supprimer les notifications existantes
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 2000;
            animation: slideIn 0.3s ease;
            background: ${type === 'success' ? '#28a745' : '#dc3545'};
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Ajouter les animations CSS pour les notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Initialiser l'application
document.addEventListener('DOMContentLoaded', () => {
    new TaskManager();
});
