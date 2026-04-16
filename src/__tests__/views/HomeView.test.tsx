import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import HomeView from '../../views/HomeView';
import { I18nProvider } from '../../i18n';

describe('HomeView', () => {
    it('chama onNavigate com "CREATE" ao clicar em Criar Sala', async () => {
        // Criamos uma função falsa (mock) para ver se ela será invocada corretamente
        const mockNavigate = vi.fn();
        const user = userEvent.setup();

        render(
            <I18nProvider>
                <HomeView onNavigate={mockNavigate} />
            </I18nProvider>
        );

        // Simulamos o usuário visualmente procurando o botão de criar sala! 
        // Em um navegador ele veria "CRIAR SALA" (se em PT-BR) ou "CREATE ROOM"
        const createBtnText = screen.getByText(/(CRIAR SALA|CREATE ROOM)/i);
        const createBtn = createBtnText.closest('button');
        
        if (createBtn) {
            await user.click(createBtn);
        }

        // Aferimos o resultado do comportamento
        expect(mockNavigate).toHaveBeenCalledWith('CREATE');
    });

    it('chama onNavigate com "JOIN" ao clicar em Entrar na Sala', async () => {
        const mockNavigate = vi.fn();
        const user = userEvent.setup();

        render(
            <I18nProvider>
                <HomeView onNavigate={mockNavigate} />
            </I18nProvider>
        );

        const joinBtnText = screen.getByText(/(ENTRAR NA SALA|JOIN ROOM)/i);
        const joinBtn = joinBtnText.closest('button');
        
        if (joinBtn) {
            await user.click(joinBtn);
        }

        expect(mockNavigate).toHaveBeenCalledWith('JOIN');
    });

    it('chama onNavigate com "BROWSE" ao clicar em Procurar Salas', async () => {
        const mockNavigate = vi.fn();
        const user = userEvent.setup();

        render(
            <I18nProvider>
                <HomeView onNavigate={mockNavigate} />
            </I18nProvider>
        );

        const browseBtnText = screen.getByText(/(PROCURAR SALAS|BROWSE ROOMS)/i);
        const browseBtn = browseBtnText.closest('button');
        
        if (browseBtn) {
            await user.click(browseBtn);
        }

        expect(mockNavigate).toHaveBeenCalledWith('BROWSE');
    });
});
