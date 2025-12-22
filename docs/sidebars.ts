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
      ],
    },
    {
      type: 'category',
      label: 'Advanced',
      items: [
        'advanced/middleware',
        'advanced/authentication',
        'advanced/rate-limiting',
        'advanced/plugins',
        'advanced/composition',
        'advanced/gateway',
      ],
    },
    {
      type: 'category',
      label: 'Observability',
      items: [
        'observability/metrics',
        'observability/health-checks',
        'observability/tracing',
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
