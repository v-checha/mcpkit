import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import CodeBlock from '@theme/CodeBlock';

import styles from './index.module.css';

const exampleCode = `import { MCPServer, Tool, Param, bootstrap, listen } from '@mcpkit-dev/core';
import { z } from 'zod';

@MCPServer({
  name: 'my-server',
  version: '1.0.0',
})
class MyServer {
  @Tool({ description: 'Add two numbers' })
  add(
    @Param({ schema: z.number() }) a: number,
    @Param({ schema: z.number() }) b: number
  ) {
    return { result: a + b };
  }
}

listen(bootstrap(MyServer));`;

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <h1 className="hero__title">{siteConfig.title}</h1>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/intro">
            Get Started →
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="https://github.com/valerachuk/mcpkit">
            View on GitHub
          </Link>
        </div>
      </div>
    </header>
  );
}

const features = [
  {
    title: 'Decorator-Based API',
    description: 'Define tools, resources, and prompts using intuitive TypeScript decorators. Clean, readable, and maintainable code.',
    icon: '🎨',
  },
  {
    title: 'Type-Safe',
    description: 'Full TypeScript support with Zod schema integration for runtime validation. Catch errors at compile time.',
    icon: '🔒',
  },
  {
    title: 'Production Ready',
    description: 'Built-in middleware, authentication, rate limiting, metrics, and distributed tracing for enterprise deployments.',
    icon: '🚀',
  },
  {
    title: 'Multiple Transports',
    description: 'Support for stdio, HTTP, SSE, and Streamable HTTP. Deploy anywhere from CLI tools to cloud services.',
    icon: '🔌',
  },
  {
    title: 'Plugin System',
    description: 'Extend functionality with plugins. Built-in plugins for metrics, health checks, CORS, and more.',
    icon: '🔧',
  },
  {
    title: 'Testing Utilities',
    description: 'Comprehensive testing package with mock clients and servers. Test your MCP servers with confidence.',
    icon: '✅',
  },
];

function Feature({ title, description, icon }: { title: string; description: string; icon: string }) {
  return (
    <div className={styles.featureCard}>
      <div className={styles.featureIcon}>{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <h2 className={styles.sectionTitle}>Why MCPKit?</h2>
        <div className={styles.featureGrid}>
          {features.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

function HomepageExample() {
  return (
    <section className={styles.example}>
      <div className="container">
        <h2 className={styles.sectionTitle}>Simple & Elegant</h2>
        <p className={styles.sectionSubtitle}>
          Build MCP servers in minutes with a clean, decorator-based API
        </p>
        <div className={styles.codeContainer}>
          <CodeBlock language="typescript">{exampleCode}</CodeBlock>
        </div>
      </div>
    </section>
  );
}

function HomepageInstall() {
  return (
    <section className={styles.install}>
      <div className="container">
        <h2 className={styles.sectionTitle}>Quick Start</h2>
        <div className={styles.installSteps}>
          <div className={styles.installStep}>
            <span className={styles.stepNumber}>1</span>
            <div>
              <h4>Create a new project</h4>
              <CodeBlock language="bash">npx @mcpkit-dev/cli create my-server</CodeBlock>
            </div>
          </div>
          <div className={styles.installStep}>
            <span className={styles.stepNumber}>2</span>
            <div>
              <h4>Run your server</h4>
              <CodeBlock language="bash">cd my-server && npm run dev</CodeBlock>
            </div>
          </div>
          <div className={styles.installStep}>
            <span className={styles.stepNumber}>3</span>
            <div>
              <h4>Connect with any MCP client</h4>
              <p>Works with Claude Desktop, VS Code extensions, and more.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home(): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} - Decorator-based MCP Server Toolkit`}
      description="Build production-ready MCP servers with TypeScript decorators. Type-safe, extensible, and easy to use.">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <HomepageExample />
        <HomepageInstall />
      </main>
    </Layout>
  );
}
