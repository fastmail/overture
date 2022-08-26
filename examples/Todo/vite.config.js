/*eslint-env node*/
import { join } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
    resolve: {
        alias: {
            '/overture/': join(__dirname, '../../source/'),
        },
    },
});
