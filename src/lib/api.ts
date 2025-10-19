const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Helper function to get token from localStorage
const getToken = () => localStorage.getItem('auth_token');

// Helper function to make authenticated requests
const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
};

// Auth API
export const authApi = {
  signUp: async (data: {
    email: string;
    password: string;
    owner_name: string;
    mobile: string;
    shop_name: string;
  }) => {
    const result = await fetchWithAuth('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (result.token) {
      localStorage.setItem('auth_token', result.token);
    }
    return result;
  },

  signIn: async (data: { email: string; password: string }) => {
    const result = await fetchWithAuth('/auth/signin', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (result.token) {
      localStorage.setItem('auth_token', result.token);
    }
    return result;
  },

  signOut: async () => {
    localStorage.removeItem('auth_token');
    return { success: true };
  },

  getUser: async () => {
    return fetchWithAuth('/auth/user');
  },
};

// Profile API
export const profileApi = {
  get: async () => {
    return fetchWithAuth('/profiles');
  },

  update: async (data: {
    owner_name: string;
    mobile: string;
    shop_name: string;
  }) => {
    return fetchWithAuth('/profiles', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

// Seller API
export const sellerApi = {
  getAll: async () => {
    return fetchWithAuth('/sellers');
  },

  search: async (query: string) => {
    return fetchWithAuth(`/sellers/search?query=${encodeURIComponent(query)}`);
  },

  getById: async (id: string) => {
    return fetchWithAuth(`/sellers/${id}`);
  },

  create: async (data: {
    name: string;
    mobile: string;
    serial_number: string;
    address: string;
    date: string;
    amount: number;
    kg: number;
  }) => {
    return fetchWithAuth('/sellers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string, data: {
    name: string;
    mobile: string;
    serial_number: string;
    address: string;
    date: string;
    amount: number;
    kg: number;
  }) => {
    return fetchWithAuth(`/sellers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string) => {
    return fetchWithAuth(`/sellers/${id}`, {
      method: 'DELETE',
    });
  },

  getTransactions: async (id: string) => {
    return fetchWithAuth(`/sellers/${id}/transactions`);
  },

  addTransaction: async (id: string, data: {
    transaction_date: string;
    amount_added: number;
    kg_added: number;
    previous_amount: number;
    previous_kg: number;
    new_total_amount: number;
    new_total_kg: number;
    flower_name?: string;
  }) => {
    return fetchWithAuth(`/sellers/${id}/transactions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateTransaction: async (id: string, txnId: string, data: {
    transaction_date: string;
    amount_added: number;
    kg_added: number;
    flower_name?: string;
    salesman_name?: string;
    salesman_mobile?: string;
    salesman_address?: string;
  }) => {
    return fetchWithAuth(`/sellers/${id}/transactions/${txnId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteTransaction: async (id: string, txnId: string) => {
    return fetchWithAuth(`/sellers/${id}/transactions/${txnId}`, {
      method: 'DELETE',
    });
  },

  // Fallback: assign salesman to a transaction by txnId only
  assignSalesmanByTxn: async (txnId: string, data: {
    salesman_name: string;
    salesman_mobile?: string;
    salesman_address?: string;
  }) => {
    return fetchWithAuth(`/sellers/transactions/${txnId}/salesman`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // sale_to contacts (sales names per seller)
  getSaleToContacts: async (id: string) => {
    return fetchWithAuth(`/sellers/${id}/sale-to`);
  },

  addSaleToContact: async (id: string, data: {
    name: string;
    mobile?: string;
    address?: string;
  }) => {
    return fetchWithAuth(`/sellers/${id}/sale-to`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getSoldToTransactions: async (id: string) => {
    return fetchWithAuth(`/sellers/${id}/sold-to`);
  },

  addSoldToTransaction: async (id: string, data: {
    customer_name: string;
    customer_mobile?: string;
    sale_date: string;
    kg_sold: number;
    amount_sold: number;
    notes?: string;
  }) => {
    return fetchWithAuth(`/sellers/${id}/sold-to`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateSoldToTransaction: async (id: string, saleId: string, data: {
    customer_name: string;
    customer_mobile?: string;
    sale_date: string;
    notes?: string;
  }) => {
    return fetchWithAuth(`/sellers/${id}/sold-to/${saleId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteSoldToTransaction: async (id: string, saleId: string) => {
    return fetchWithAuth(`/sellers/${id}/sold-to/${saleId}`, {
      method: 'DELETE',
    });
  },

  // Payments API
  getPayments: async (id: string) => {
    return fetchWithAuth(`/sellers/${id}/payments`);
  },

  addPayment: async (id: string, data: {
    from_date?: string;
    to_date?: string;
    amount: number;
    cleared_kg: number;
    notes?: string;
  }) => {
    return fetchWithAuth(`/sellers/${id}/payments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// Reports API
export const reportsApi = {
  // date format: YYYY-MM-DD
  eod: async (date: string) => {
    return fetchWithAuth(`/reports/eod?date=${encodeURIComponent(date)}`);
  },
};

// Check if user is authenticated
export const isAuthenticated = () => {
  return !!getToken();
};
