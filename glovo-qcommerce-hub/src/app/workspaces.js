export const WORKSPACES = {
  mfc: {
    id: 'mfc',
    label: 'MFC',
    fullLabel: 'Micro-fulfillment Center',
    description: 'Micro-fulfillment centers and inventory management systems.',
    path: '/mfc',
    icon: 'warehouse',
    status: { label: 'Healthy', tone: 'positive' },
    accent: {
      accent: '#00A082',
      onAccent: '#ffffff',
      accentContainer: '#00A082',
      onAccentContainer: '#00382b'
    }
  },
  groceries: {
    id: 'groceries',
    label: 'Groceries',
    fullLabel: 'Groceries',
    description: 'Fresh market vertical, vendor integrations, and stock replenishment.',
    path: '/groceries',
    icon: 'local_grocery_store',
    status: { label: 'Monitoring', tone: 'warning' },
    accent: {
      accent: '#8a5c00',
      onAccent: '#ffffff',
      accentContainer: '#FFC244',
      onAccentContainer: '#5e4200'
    }
  },
  retail: {
    id: 'retail',
    label: 'Retail',
    fullLabel: 'Retail',
    description: 'Partner portals, catalog management, and high-street logistics.',
    path: '/retail',
    icon: 'shopping_bag',
    status: { label: 'Staged', tone: 'neutral' },
    accent: {
      accent: '#375aa5',
      onAccent: '#ffffff',
      accentContainer: '#375aa5',
      onAccentContainer: '#001a41'
    }
  }
};

export const WORKSPACE_LIST = Object.values(WORKSPACES);
