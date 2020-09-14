import { basename } from 'path';

export default function () {
    return {
        name: 'preload-dynamic-imports',
        renderDynamicImport({ format, targetModuleId }) {
            if (format !== 'es') {
                return null;
            }
            const module = basename(targetModuleId, '.js');
            return {
                left: `(FM.preloadModuleDependencies('${module}'),import(`,
                right: '))',
            };
        },
    };
}
