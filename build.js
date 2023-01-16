#!/usr/bin/env node

import esbuild from 'esbuild';

Promise.all([
    esbuild.build({
        entryPoints: ['source/Overture.js'],
        bundle: true,
        target: 'es6',
        format: 'iife',
        outfile: 'dist/O.js',
    }),
    esbuild.build({
        entryPoints: ['source/Overture.js'],
        bundle: true,
        minify: true,
        sourcemap: 'linked',
        target: 'es6',
        format: 'iife',
        outfile: 'dist/O.min.js',
    }),
]).catch(() => process.exit(1));
