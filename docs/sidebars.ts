import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/installation',
        'getting-started/quick-start',
        'getting-started/typescript-config',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/tools',
        'guides/resources',
        'guides/prompts',
        'guides/hooks',
        'guides/testing',
        'guides/debugging',
        'guides/tracing-decorator',
      ],
    },
    {
      type: 'category',
      label: 'Advanced',
      items: [
        'advanced/middleware',
        'advanced/middleware-utilities',
        'advanced/authentication',
        'advanced/rate-limiting',
        'advanced/plugins',
        'advanced/plugins-guide',
        'advanced/composition',
        'advanced/gateway',
      ],
    },
    {
      type: 'category',
      label: 'Observability',
      items: [
        'observability/overview',
        'observability/metrics',
        'observability/tracing',
        'observability/health-checks',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api/decorators',
        'api/types',
        'api/exports',
      ],
    },
  ],
};

export default sidebars;
