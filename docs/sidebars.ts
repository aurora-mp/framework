import coreTypedocSidebar from './docs/api/core/typedoc-sidebar.cjs';
import clientTypedocSidebar from './docs/api/client/typedoc-sidebar.cjs';
import serverTypedocSidebar from './docs/api/server/typedoc-sidebar.cjs';
import webviewTypedocSidebar from './docs/api/webview/typedoc-sidebar.cjs';

const sidebars = {
    tutorialSidebar: [
        'intro',
        {
            type: 'category',
            label: 'Getting Started',
            collapsible: true,
            collapsed: false,
            items: ['getting-started/requirements', 'getting-started/installation'],
        },
    ],

    apiSidebar: [
        {
            type: 'category',
            label: 'Core',
            link: {
                type: 'doc',
                id: 'api/core/index',
            },
            items: coreTypedocSidebar,
        },
        {
            type: 'category',
            label: 'Client',
            link: {
                type: 'doc',
                id: 'api/client/index',
            },
            items: clientTypedocSidebar,
        },
        {
            type: 'category',
            label: 'Server',
            link: {
                type: 'doc',
                id: 'api/server/index',
            },
            items: serverTypedocSidebar,
        },
        {
            type: 'category',
            label: 'Webview',
            link: {
                type: 'doc',
                id: 'api/webview/index',
            },
            items: webviewTypedocSidebar,
        },
    ],
};

export default sidebars;
