// js/timesheet.js - Sistema Timesheet Avanzato

const TimesheetManager = {
    allocations: {},
    expandedEmployees: new Set(),
    isLoading: false,
    
    async init() {
        console.log('Inizializzazione Timesheet Manager...');
        await this.loadAllocations();
        this.render();
    },
    
    async loadAllocations() {
        const userId = Auth.getUser()?.id;
        if (!userId) return;
        
        try {
            this.isLoading = true;
            
            const { data, error } = await supabase
                .from('allocations')
                .select('*')
                .eq('user_id', userId);
            
            if (error) throw error;
            
            // Ricostruisci l'oggetto allocations
            this.allocations = {};
            data.forEach(alloc => {
                const key = `${alloc.employee_id}-${alloc.project_id}`;
                this.allocations[key] = alloc.percentage;
            });
            
            console.log(`Caricate ${data.length} allocazioni`);
            
        } catch (error) {
            console.error('Errore caricamento allocazioni:', error);
            showNotification('Errore caricamento allocazioni', 'error');
        } finally {
            this.isLoading = false;
        }
    },
    
    render() {
        const container = document.getElementById('timesheetTable');
        const summaryContainer = document.getElementById('projectSummary');
        
        if (!container) return;
        
        const employees = EmployeesManager.getAll();
        const projects = ProjectsManager.getAll();
        
        if (employees.length === 0 || projects.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-table"></i>
                    <p>Aggiungi dipendenti e progetti per gestire il timesheet</p>
                </div>
            `;
            if (summaryContainer) summaryContainer.innerHTML = '';
            return;
        }
        
        let html = `
            <div class="timesheet-tabs">
                <button class="timesheet-tab active" onclick="TimesheetManager.showView('allocations')">
                    <i class="fas fa-percentage"></i> Allocazione e Dettaglio
                </button>
                <button class="timesheet-tab" onclick="TimesheetManager.showView('summary')">
                    <i class="fas fa-chart-bar"></i> Riepilogo Progetti
                </button>
            </div>
        `;
        
        html += `<div id="allocationsView" class="timesheet-view active">`;
        html += this.renderAllocationsAccordion(employees, projects);
        html += `</div>`;
        
        html += `<div id="summaryView" class="timesheet-view" style="display:none;">`;
        html += this.renderProjectsSummary(projects);
        html += `</div>`;
        
        container.innerHTML = html;
        
        this.renderProjectSummary(summaryContainer);
    },
    
    renderAllocationsAccordion(employees, projects) {
        let html = `
            <div class="allocations-header">
                <div class="info-banner">
                    <i class="fas fa-info-circle"></i>
                    <span>Inserisci le percentuali di tempo per ogni progetto. Clicca su un dipendente per vedere il dettaglio mensile.</span>
                </div>
                
                <div class="allocations-controls">
                    <button class="btn btn-sm" onclick="TimesheetManager.expandAll()">
                        <i class="fas fa-expand-alt"></i> Espandi tutti
                    </button>
                    <button class="btn btn-sm" onclick="TimesheetManager.collapseAll()">
                        <i class="fas fa-compress-alt"></i> Comprimi tutti
                    </button>
                </div>
            </div>
            
            <div class="employees-accordion">
        `;
        
        employees.forEach(emp => {
            const isExpanded = this.expandedEmployees.has(emp.id);
            const totalAllocation = this.calculateEmployeeAllocation(emp.id);
            const hasHistory = emp.storicoMensile && Object.keys(emp.storicoMensile).length > 0;
            const totalHours = emp.oreAnnualiTotali || emp.oreAnnuali || 0;
            const totalCost = emp.costoAnnuale || 0;
            
            let allocatedHours = 0;
            if (hasHistory) {
                Object.values(emp.storicoMensile).forEach(mese => {
                    projects.forEach(proj => {
                        const key = `${emp.id}-${proj.id}`;
                        const percentage = this.allocations[key] || 0;
                        allocatedHours += (mese.ore * percentage / 100);
                    });
                });
            } else {
                projects.forEach(proj => {
                    const key = `${emp.id}-${proj.id}`;
                    const percentage = this.allocations[key] || 0;
                    allocatedHours += (totalHours * percentage / 100);
                });
            }
            
            let allocationStatus = 'normal';
            let statusIcon = '';
            if (totalAllocation > 100) {
                allocationStatus = 'over';
                statusIcon = '<i class="fas fa-exclamation-triangle"></i>';
            } else if (totalAllocation === 100) {
                allocationStatus = 'perfect';
                statusIcon = '<i class="fas fa-check-circle"></i>';
            } else if (totalAllocation > 0) {
                allocationStatus = 'under';
                statusIcon = '<i class="fas fa-exclamation-circle"></i>';
            } else {
                allocationStatus = 'none';
                statusIcon = '<i class="fas fa-times-circle"></i>';
            }
            
            html += `
                <div class="employee-accordion-item ${allocationStatus}">
                    <div class="employee-accordion-header" onclick="TimesheetManager.toggleEmployee('${emp.id}')">
                        <div class="employee-info">
                            <div class="employee-name">
                                <i class="fas fa-chevron-${isExpanded ? 'down' : 'right'} accordion-icon"></i>
                                <strong>${Utils.escapeHtml(emp.nome)}</strong>
                                <span class="employee-role">${Utils.escapeHtml(emp.qualifica)}</span>
                            </div>
                            <div class="employee-meta">
                                ${hasHistory ? 
                                    `<span class="meta-badge"><i class="fas fa-calendar"></i> ${emp.numeroMensilita} mesi</span>` : 
                                    '<span class="meta-badge"><i class="fas fa-calendar"></i> 12 mesi (stimati)</span>'
                                }
                                <span class="meta-badge"><i class="fas fa-clock"></i> ${totalHours}h totali</span>
                                <span class="meta-badge"><i class="fas fa-clock"></i> ${allocatedHours.toFixed(0)}h allocate</span>
                                <span class="meta-badge"><i class="fas fa-euro-sign"></i> ${Utils.formatCurrency(totalCost)}</span>
                            </div>
                        </div>
                        
                        <div class="employee-allocation-summary">
                            <div class="allocation-bar">
                                <div class="allocation-fill ${allocationStatus}" style="width: ${Math.min(totalAllocation, 120)}%">
                                    <span class="allocation-text">${totalAllocation}%</span>
                                </div>
                            </div>
                            <div class="allocation-status">
                                ${statusIcon}
                            </div>
                        </div>
                        
                        <div class="employee-quick-actions" onclick="event.stopPropagation()">
                            ${projects.map(proj => {
                                const key = `${emp.id}-${proj.id}`;
                                const value = this.allocations[key] || 0;
                                return `
                                    <div class="quick-allocation">
                                        <label>${Utils.escapeHtml(proj.name) || 'Senza nome'}:</label>
                                        <input type="number" 
                                               class="quick-percentage-input" 
                                               min="0" 
                                               max="100" 
                                               step="5"
                                               value="${value}"
                                               onchange="TimesheetManager.updateAllocation('${emp.id}', '${proj.id}', this.value)"
                                               onclick="event.stopPropagation()">
                                        <span>%</span>
                                    </div>
                                `;
                            }).join('')}
                            
                            <button class="btn-icon" onclick="TimesheetManager.distributeEqually('${emp.id}')" 
                                    title="Distribuisci equamente">
                                <i class="fas fa-balance-scale"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="employee-accordion-content ${isExpanded ? 'expanded' : ''}">
                        ${this.renderEmployeeMonthlyDetail(emp, projects)}
                    </div>
                </div>
            `;
        });
        
        html += `
            </div>
            
            <div class="allocations-footer">
                <div class="totals-summary">
                    <h4>Totali per Progetto</h4>
                    <div class="project-totals">
                        ${projects.map(proj => {
                            const hours = this.calculateProjectHoursFromTimesheet(proj.id);
                            const cost = this.calculateProjectCostFromTimesheet(proj.id);
                            return `
                                <div class="project-total-item">
                                    <span class="project-name">${Utils.escapeHtml(proj.name) || 'Senza nome'}</span>
                                    <span class="project-hours">${hours.toFixed(0)}h</span>
                                    <span class="project-cost">${Utils.formatCurrency(cost)}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                
                <div class="actions-bar">
                    <button class="btn btn-secondary" onclick="TimesheetManager.resetAllocations()">
                        <i class="fas fa-undo"></i> Reset Allocazioni
                    </button>
                    <button class="btn btn-secondary" onclick="TimesheetManager.exportTimesheet()">
                        <i class="fas fa-download"></i> Esporta Excel
                    </button>
                </div>
            </div>
        `;
        
        return html;
    },
    
    toggleEmployee(employeeId) {
        if (this.expandedEmployees.has(employeeId)) {
            this.expandedEmployees.delete(employeeId);
        } else {
            this.expandedEmployees.add(employeeId);
        }
        
        const item = document.querySelector(`#allocationsView .employee-accordion-item:has([onclick*="${employeeId}"])`);
        if (item) {
            const content = item.querySelector('.employee-accordion-content');
            const icon = item.querySelector('.accordion-icon');
            
            if (this.expandedEmployees.has(employeeId)) {
                content.classList.add('expanded');
                icon.classList.remove('fa-chevron-right');
                icon.classList.add('fa-chevron-down');
            } else {
                content.classList.remove('expanded');
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-right');
            }
        }
    },
    
    expandAll() {
        const employees = EmployeesManager.getAll();
        employees.forEach(emp => this.expandedEmployees.add(emp.id));
        this.render();
    },
    
    collapseAll() {
        this.expandedEmployees.clear();
        this.render();
    },
    
    renderEmployeeMonthlyDetail(employee, projects) {
        if (!employee.storicoMensile || Object.keys(employee.storicoMensile).length === 0) {
            return `
                <div class="no-monthly-data">
                    <i class="fas fa-info-circle"></i>
                    <p>Nessun dettaglio mensile disponibile. Le ore sono stimate su base annuale.</p>
                </div>
            `;
        }
        
        const mesi = Object.keys(employee.storicoMensile).sort();
        
        let html = `
            <div class="monthly-detail-section">
                <h4>Dettaglio Mensile - Ore per Progetto</h4>
                <table class="monthly-detail-table">
                    <thead>
                        <tr>
                            <th>Mese</th>
                            <th>Ore Totali</th>
                            ${projects.map(p => `<th>${Utils.escapeHtml(p.name) || 'Senza nome'}</th>`).join('')}
                            <th>Costo Mensile</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        let totalsByProject = {};
        let totalCost = 0;
        let totalHours = 0;
        projects.forEach(p => totalsByProject[p.id] = 0);
        
        mesi.forEach((mese, index) => {
            const datiMese = employee.storicoMensile[mese];
            const oreMese = parseFloat(datiMese.ore) || 0;
            totalHours += oreMese;
            
            html += `
                <tr class="${index % 2 === 0 ? 'even' : 'odd'}">
                    <td><strong>${mese}</strong></td>
                    <td>${oreMese}h</td>
            `;
            
            let costoMeseAllocato = 0;
            
            projects.forEach(proj => {
                const key = `${employee.id}-${proj.id}`;
                const percentage = this.allocations[key] || 0;
                
                const oreProgetto = (oreMese * percentage) / 100;
                const costoProgetto = oreProgetto * datiMese.costoOrario;
                
                totalsByProject[proj.id] += oreProgetto;
                costoMeseAllocato += costoProgetto;
                
                html += `<td title="${percentage}% di ${oreMese}h = ${oreProgetto.toFixed(1)}h">${percentage > 0 ? oreProgetto.toFixed(1) + 'h' : '-'}</td>`;
            });
            
            totalCost += costoMeseAllocato;
            
            html += `
                    <td>${Utils.formatCurrency(costoMeseAllocato)}</td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                    <tfoot>
                        <tr class="totals-row">
                            <td><strong>TOTALE</strong></td>
                            <td><strong>${totalHours.toFixed(0)}h</strong></td>
                            ${projects.map(p => 
                                `<td><strong>${totalsByProject[p.id] > 0 ? totalsByProject[p.id].toFixed(0) + 'h' : '-'}</strong></td>`
                            ).join('')}
                            <td><strong>${Utils.formatCurrency(totalCost)}</strong></td>
                        </tr>
                    </tfoot>
                </table>
                
                <div class="monthly-summary">
                    <p><i class="fas fa-info-circle"></i> 
                    Costo orario medio: ${Utils.formatCurrency(employee.costoOrarioMedio)}/h 
                    ${employee.costoCalcolato ? '<span class="warning-text">(stimato)</span>' : ''}
                    </p>
                </div>
            </div>
        `;
        
        return html;
    },
    
    renderProjectsSummary(projects) {
        let html = `
            <div class="projects-summary">
                <h3>Riepilogo Progetti</h3>
                <div class="projects-grid">
        `;
        
        projects.forEach(project => {
            const allocations = this.getProjectAllocationsDetailed(project.id);
            const totalHours = this.calculateProjectHoursFromTimesheet(project.id);
            const totalCost = this.calculateProjectCostFromTimesheet(project.id);
            const creditRate = ProjectsManager.getCreditRate(project.type);
            const credit = totalCost * creditRate;
            
            html += `
                <div class="project-summary-card">
                    <div class="project-header">
                        <h4>${Utils.escapeHtml(project.name) || 'Senza nome'}</h4>
                        <span class="project-type">${ProjectsManager.getProjectTypeLabel(project.type)}</span>
                    </div>
                    
                    <div class="project-stats">
                        <div class="stat">
                            <label>Team</label>
                            <value>${allocations.length} persone</value>
                        </div>
                        <div class="stat">
                            <label>Ore totali</label>
                            <value>${totalHours.toFixed(0)}h</value>
                        </div>
                        <div class="stat">
                            <label>Costo personale</label>
                            <value>${Utils.formatCurrency(totalCost)}</value>
                        </div>
                        <div class="stat highlight">
                            <label>Credito R&S (${(creditRate * 100).toFixed(0)}%)</label>
                            <value>${Utils.formatCurrency(credit)}</value>
                        </div>
                    </div>
                    
                    <div class="project-team">
                        <h5>Team Assegnato:</h5>
                        ${allocations.length === 0 ? 
                            '<p class="empty-state small">Nessun dipendente assegnato</p>' :
                            allocations.map(alloc => `
                                <div class="team-member">
                                    <span>${Utils.escapeHtml(alloc.employee.nome)}</span>
                                    <span>${alloc.percentage}%</span>
                                    <span>${alloc.hours.toFixed(0)}h</span>
                                </div>
                            `).join('')
                        }
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
        
        return html;
    },
    
    showView(viewName) {
        document.querySelectorAll('.timesheet-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        event.target.classList.add('active');
        
        document.querySelectorAll('.timesheet-view').forEach(view => {
            view.style.display = 'none';
        });
        
        const view = document.getElementById(`${viewName}View`);
        if (view) {
            view.style.display = 'block';
        }
    },
    
    async updateAllocation(employeeId, projectId, percentage) {
        const userId = Auth.getUser()?.id;
        if (!userId) return;
        
        const key = `${employeeId}-${projectId}`;
        const value = Math.max(0, Math.min(100, parseInt(percentage) || 0));
        
        try {
            if (value === 0) {
                // Rimuovi allocazione
                delete this.allocations[key];
                
                await supabase
                    .from('allocations')
                    .delete()
                    .eq('user_id', userId)
                    .eq('employee_id', employeeId)
                    .eq('project_id', projectId);
                    
            } else {
                // Aggiorna o inserisci allocazione
                this.allocations[key] = value;
                
                const { error } = await supabase
                    .from('allocations')
                    .upsert({
                        user_id: userId,
                        employee_id: employeeId,
                        project_id: projectId,
                        percentage: value,
                        updated_at: new Date().toISOString()
                    });
                
                if (error) throw error;
            }
            
            this.updateEmployeeRow(employeeId);
            this.updateProjectSummary();
            
        } catch (error) {
            console.error('Errore aggiornamento allocazione:', error);
            showNotification('Errore aggiornamento allocazione', 'error');
        }
    },
    
    updateEmployeeRow(employeeId) {
        const employee = EmployeesManager.getById(employeeId);
        if (!employee) return;
        
        const totalAllocation = this.calculateEmployeeAllocation(employeeId);
        const projects = ProjectsManager.getAll();
        
        const item = document.querySelector(`.employee-accordion-item:has([onclick*="${employeeId}"])`);
        if (!item) return;
        
        const allocationBar = item.querySelector('.allocation-fill');
        const allocationText = item.querySelector('.allocation-text');
        const statusIcon = item.querySelector('.allocation-status');
        
        let allocationStatus = 'normal';
        let newStatusIcon = '';
        if (totalAllocation > 100) {
            allocationStatus = 'over';
            newStatusIcon = '<i class="fas fa-exclamation-triangle"></i>';
        } else if (totalAllocation === 100) {
            allocationStatus = 'perfect';
            newStatusIcon = '<i class="fas fa-check-circle"></i>';
        } else if (totalAllocation > 0) {
            allocationStatus = 'under';
            newStatusIcon = '<i class="fas fa-exclamation-circle"></i>';
        } else {
            allocationStatus = 'none';
            newStatusIcon = '<i class="fas fa-times-circle"></i>';
        }
        
        allocationBar.className = `allocation-fill ${allocationStatus}`;
        allocationBar.style.width = `${Math.min(totalAllocation, 120)}%`;
        allocationText.textContent = `${totalAllocation}%`;
        statusIcon.innerHTML = newStatusIcon;
        
        item.className = `employee-accordion-item ${allocationStatus}`;
        
        // Aggiorna ore allocate
        const totalHours = employee.oreAnnualiTotali || employee.oreAnnuali || 0;
        let allocatedHours = 0;
        
        if (employee.storicoMensile && Object.keys(employee.storicoMensile).length > 0) {
            Object.values(employee.storicoMensile).forEach(mese => {
                projects.forEach(proj => {
                    const key = `${employee.id}-${proj.id}`;
                    const percentage = this.allocations[key] || 0;
                    allocatedHours += (mese.ore * percentage / 100);
                });
            });
        } else {
            projects.forEach(proj => {
                const key = `${employee.id}-${proj.id}`;
                const percentage = this.allocations[key] || 0;
                allocatedHours += (totalHours * percentage / 100);
            });
        }
        
        const allocatedBadge = item.querySelector('.meta-badge:nth-child(3)');
        if (allocatedBadge) {
            allocatedBadge.innerHTML = `<i class="fas fa-clock"></i> ${allocatedHours.toFixed(0)}h allocate`;
        }
        
        // Aggiorna contenuto dettagliato se espanso
        if (this.expandedEmployees.has(employeeId)) {
            const content = item.querySelector('.employee-accordion-content');
            if (content) {
                const newContent = this.renderEmployeeMonthlyDetail(employee, projects);
                content.innerHTML = newContent;
                content.classList.add('expanded');
            }
        }
    },
    
    updateProjectSummary() {
        const container = document.getElementById('projectSummary');
        if (container) {
            this.renderProjectSummary(container);
        }
        
        // Aggiorna totali nella vista allocazioni
        const projectTotals = document.querySelector('.project-totals');
        if (projectTotals) {
            const projects = ProjectsManager.getAll();
            projectTotals.innerHTML = projects.map(proj => {
                const hours = this.calculateProjectHoursFromTimesheet(proj.id);
                const cost = this.calculateProjectCostFromTimesheet(proj.id);
                return `
                    <div class="project-total-item">
                        <span class="project-name">${Utils.escapeHtml(proj.name) || 'Senza nome'}</span>
                        <span class="project-hours">${hours.toFixed(0)}h</span>
                        <span class="project-cost">${Utils.formatCurrency(cost)}</span>
                    </div>
                `;
            }).join('');
        }
        
        // Aggiorna stats dei progetti
        if (window.ProjectsManager) {
            ProjectsManager.updateProjectStats();
        }
    },
    
    calculateEmployeeAllocation(employeeId) {
        let total = 0;
        const projects = ProjectsManager.getAll();
        
        projects.forEach(proj => {
            const key = `${employeeId}-${proj.id}`;
            total += (this.allocations[key] || 0);
        });
        
        return total;
    },
    
    async distributeEqually(employeeId) {
        const projects = ProjectsManager.getAll();
        const equalPercentage = Math.floor(100 / projects.length);
        let remaining = 100 - (equalPercentage * projects.length);
        
        for (let i = 0; i < projects.length; i++) {
            const proj = projects[i];
            const percentage = i === projects.length - 1 ? 
                equalPercentage + remaining : equalPercentage;
            await this.updateAllocation(employeeId, proj.id, percentage);
        }
    },
    
    async resetAllocations() {
        if (!confirm('Sicuro di voler azzerare tutte le allocazioni?')) {
            return;
        }
        
        const userId = Auth.getUser()?.id;
        if (!userId) return;
        
        try {
            showLoading(true);
            
            // Elimina tutte le allocazioni dal database
            const { error } = await supabase
                .from('allocations')
                .delete()
                .eq('user_id', userId);
            
            if (error) throw error;
            
            this.allocations = {};
            this.render();
            
            showNotification('Allocazioni resettate con successo', 'success');
            
        } catch (error) {
            console.error('Errore reset allocazioni:', error);
            showNotification('Errore reset allocazioni', 'error');
        } finally {
            showLoading(false);
        }
    },
    
    calculateProjectHoursFromTimesheet(projectId) {
        let totalHours = 0;
        const employees = EmployeesManager.getAll();
        
        employees.forEach(emp => {
            const key = `${emp.id}-${projectId}`;
            const percentage = this.allocations[key] || 0;
            
            if (percentage > 0) {
                if (emp.storicoMensile && Object.keys(emp.storicoMensile).length > 0) {
                    Object.values(emp.storicoMensile).forEach(mese => {
                        totalHours += (mese.ore * percentage / 100);
                    });
                } else {
                    totalHours += (emp.oreAnnuali * percentage / 100);
                }
            }
        });
        
        return totalHours;
    },
    
    calculateProjectCostFromTimesheet(projectId) {
        let totalCost = 0;
        const employees = EmployeesManager.getAll();
        
        employees.forEach(emp => {
            const key = `${emp.id}-${projectId}`;
            const percentage = this.allocations[key] || 0;
            
            if (percentage > 0) {
                if (emp.storicoMensile && Object.keys(emp.storicoMensile).length > 0) {
                    Object.values(emp.storicoMensile).forEach(mese => {
                        const oreMese = mese.ore * percentage / 100;
                        totalCost += oreMese * mese.costoOrario;
                    });
                } else {
                    const yearlyHours = emp.oreAnnuali * percentage / 100;
                    totalCost += yearlyHours * emp.costoOrario;
                }
            }
        });
        
        return totalCost;
    },
    
    getProjectAllocationsDetailed(projectId) {
        const allocations = [];
        const employees = EmployeesManager.getAll();
        
        employees.forEach(emp => {
            const key = `${emp.id}-${projectId}`;
            const percentage = this.allocations[key] || 0;
            
            if (percentage > 0) {
                let hours = 0;
                let cost = 0;
                
                if (emp.storicoMensile && Object.keys(emp.storicoMensile).length > 0) {
                    Object.values(emp.storicoMensile).forEach(mese => {
                        const oreMese = mese.ore * percentage / 100;
                        hours += oreMese;
                        cost += oreMese * mese.costoOrario;
                    });
                } else {
                    hours = emp.oreAnnuali * percentage / 100;
                    cost = hours * emp.costoOrario;
                }
                
                allocations.push({
                    employee: emp,
                    percentage: percentage,
                    hours: hours,
                    cost: cost
                });
            }
        });
        
        return allocations;
    },
    
    renderProjectSummary(container) {
        if (!container) return;
        
        const projects = ProjectsManager.getAll();
        
        const summaryHTML = projects.map(project => {
            const hours = this.calculateProjectHoursFromTimesheet(project.id);
            const cost = this.calculateProjectCostFromTimesheet(project.id);
            const creditRate = ProjectsManager.getCreditRate(project.type);
            const credit = cost * creditRate;
            
            return `
                <div class="summary-card">
                    <h4>${Utils.escapeHtml(project.name) || 'Progetto'}</h4>
                    <div class="summary-details">
                        <div class="summary-row">
                            <span>Tipo:</span>
                            <span>${ProjectsManager.getProjectTypeLabel(project.type)}</span>
                        </div>
                        <div class="summary-row">
                            <span>Anno:</span>
                            <span>${project.year}</span>
                        </div>
                        <div class="summary-row">
                            <span>Ore totali:</span>
                            <span>${hours.toFixed(0)}h</span>
                        </div>
                        <div class="summary-row">
                            <span>Costo personale:</span>
                            <span>${Utils.formatCurrency(cost)}</span>
                        </div>
                        <div class="summary-row">
                            <span>Aliquota credito:</span>
                            <span>${(creditRate * 100).toFixed(0)}%</span>
                        </div>
                        <div class="summary-row highlight">
                            <span>Credito stimato:</span>
                            <span>${Utils.formatCurrency(credit)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = summaryHTML;
        
        // Aggiorna stats dei progetti
        if (window.ProjectsManager) {
            ProjectsManager.updateProjectStats();
        }
    },
    
    async exportTimesheet() {
        const employees = EmployeesManager.getAll();
        const projects = ProjectsManager.getAll();
        
        // Prepara i dati per l'export
        const exportData = [];
        
        // Intestazione
        exportData.push(['Timesheet Dettagliato - Credito R&S']);
        exportData.push(['Data export:', new Date().toLocaleDateString('it-IT')]);
        exportData.push([]);
        
        // Dettaglio per dipendente
        employees.forEach(emp => {
            exportData.push([emp.nome + ' - ' + emp.qualifica]);
            
            if (emp.storicoMensile && Object.keys(emp.storicoMensile).length > 0) {
                // Intestazioni colonne
                const headers = ['Mese', 'Ore Totali'];
                projects.forEach(p => headers.push(p.name || 'Senza nome'));
                headers.push('Costo Mensile');
                exportData.push(headers);
                
                // Dati mensili
                const mesi = Object.keys(emp.storicoMensile).sort();
                mesi.forEach(mese => {
                    const datiMese = emp.storicoMensile[mese];
                    const row = [mese, datiMese.ore];
                    
                    let costoMese = 0;
                    projects.forEach(proj => {
                        const key = `${emp.id}-${proj.id}`;
                        const perc = this.allocations[key] || 0;
                        const ore = (datiMese.ore * perc / 100);
                        row.push(`${ore.toFixed(1)}h (${perc}%)`);
                        costoMese += ore * datiMese.costoOrario;
                    });
                    
                    row.push(costoMese.toFixed(2));
                    exportData.push(row);
                });
            }
            
            exportData.push([]);
        });
        
        // Riepilogo progetti
        exportData.push(['RIEPILOGO PROGETTI']);
        exportData.push(['Progetto', 'Tipo', 'Ore Totali', 'Costo', 'Aliquota', 'Credito Stimato']);
        
        projects.forEach(proj => {
            const hours = this.calculateProjectHoursFromTimesheet(proj.id);
            const cost = this.calculateProjectCostFromTimesheet(proj.id);
            const rate = ProjectsManager.getCreditRate(proj.type);
            const credit = cost * rate;
            
            exportData.push([
                proj.name || 'Senza nome',
                ProjectsManager.getProjectTypeLabel(proj.type),
                hours.toFixed(0),
                cost.toFixed(2),
                (rate * 100) + '%',
                credit.toFixed(2)
            ]);
        });
        
        // Converti in CSV
        const csv = exportData.map(row => 
            row.map(cell => {
                const value = String(cell);
                return value.includes(',') ? `"${value}"` : value;
            }).join(',')
        ).join('\n');
        
        // Download
        Utils.downloadFile('\ufeff' + csv, `timesheet_rs_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8');
        
        showNotification('Timesheet esportato con successo', 'success');
    },
    
    // Metodi pubblici per altri moduli
    calculateProjectHours(projectId) {
        return this.calculateProjectHoursFromTimesheet(projectId);
    },
    
    calculateProjectCost(projectId) {
        return this.calculateProjectCostFromTimesheet(projectId);
    },
    
    getProjectAllocations(projectId) {
        return this.getProjectAllocationsDetailed(projectId);
    },
    
    getAllocationsForEmployee(employeeId) {
        const allocations = [];
        const projects = ProjectsManager.getAll();
        
        projects.forEach(proj => {
            const key = `${employeeId}-${proj.id}`;
            const percentage = this.allocations[key] || 0;
            if (percentage > 0) {
                allocations.push({
                    projectId: proj.id,
                    projectName: proj.name,
                    percentage: percentage
                });
            }
        });
        
        return allocations;
    }
};

// Export
window.TimesheetManager = TimesheetManager;