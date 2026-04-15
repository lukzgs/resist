import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import HomeView from '../../views/HomeView';
import { I18nProvider } from '../../i18n';

describe('HomeView Screen', () => {
    it('calls onNavigate with "CREATE" when clicking Create Room', async () => {
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
});
