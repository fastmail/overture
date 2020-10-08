export default function (config) {
    const trimPrefix = (config && config.trimPrefix) || /^.*[/]/;
    return {
        name: 'preload-dynamic-imports',
        renderDynamicImport({ format, targetModuleId }) {
            if (format !== 'es' || !targetModuleId) {
                return null;
            }
            const module = targetModuleId.replace(trimPrefix, '/');
            return {
                left: `(FM.preloadModuleDependencies('${module}'),Promise.resolve(import(`,
                right: ')))',
            };
        },
    };
}
