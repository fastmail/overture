const NEW_TODO_TEXT = 'Eat pie! 😎';

describe('Todos', () => {
    it('Creates, undoes todo', () => {
        cy.visit('http://localhost:5173/inbox/');
        cy.contains('New Todo').click();
        cy.get('.v-Todo-summary .v-TextInput-input')
            .click()
            .type(NEW_TODO_TEXT + '{enter}');
        cy.contains(NEW_TODO_TEXT);
        cy.contains('Undo').click();
        cy.contains(NEW_TODO_TEXT).should('not.exist');
    });
});
