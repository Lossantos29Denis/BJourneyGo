/**
 * SISTEMA DE ROLES PARA INTRANET
 * 
 * Este archivo documenta cómo funciona el sistema de roles implementado
 * para permitir que las agencias accedan a la intranet con permisos limitados.
 */

// ============================================
// ROLES DISPONIBLES
// ============================================

/**
 * - admin: Acceso completo a todas las funcionalidades
 * - agency: Acceso limitado solo a gestión de billetes y estadísticas propias
 */

// ============================================
// ESTRUCTURA DE DATOS EN LOCALSTORAGE
// ============================================

/**
 * Cuando un usuario inicia sesión, se guardan los siguientes datos:
 * 
 * localStorage.setItem('intranetAuth', 'true');          // Autenticación válida
 * localStorage.setItem('intranetUser', 'username');      // Nombre de usuario
 * localStorage.setItem('intranetRole', 'admin|agency');  // Rol del usuario
 * localStorage.setItem('agencyId', 'AG001');             // ID de la agencia (solo para role=agency)
 * localStorage.setItem('agencyName', 'Viajes Norte');    // Nombre de la agencia (solo para role=agency)
 */

// ============================================
// DATOS DE EJEMPLO - AGENCIAS
// ============================================

const exampleAgencies = [
  {
    id: 'AG001',
    name: 'Viajes Norte',
    username: 'agencia.norte',
    email: 'contacto@viajesnorte.com',
    password: 'hashed_password_here', // En producción usar bcrypt
    role: 'agency',
    isAdmin: false,
    status: 'active',
    routes: ['MAD-BCN-001', 'BCN-VAL-002', 'VAL-ALC-004', 'MAD-VAL-007'],
    createdAt: '2025-01-01T10:00:00Z'
  },
  {
    id: 'AG002',
    name: 'Buses del Sur',
    username: 'agencia.sur',
    email: 'info@busesdelsur.com',
    password: 'hashed_password_here',
    role: 'agency',
    isAdmin: false,
    status: 'active',
    routes: ['MAD-SEV-003', 'BCN-MAD-005', 'SEV-GRX-006', 'BCN-ZAR-008'],
    createdAt: '2025-01-05T14:30:00Z'
  },
  {
    id: 'ADMIN001',
    name: 'Administrador Principal',
    username: 'admin',
    email: 'admin@bjourneygo.com',
    password: 'hashed_password_here',
    role: 'admin',
    isAdmin: true,
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z'
  }
];

// ============================================
// MODIFICACIONES NECESARIAS EN LA API
// ============================================

/**
 * El endpoint /api/login debe devolver:
 * 
 * Para un admin:
 * {
 *   success: true,
 *   isAdmin: true,
 *   role: 'admin',
 *   user: 'admin',
 *   email: 'admin@bjourneygo.com'
 * }
 * 
 * Para una agencia:
 * {
 *   success: true,
 *   isAdmin: false,
 *   role: 'agency',
 *   user: 'agencia.norte',
 *   email: 'contacto@viajesnorte.com',
 *   agencyId: 'AG001',
 *   agencyName: 'Viajes Norte'
 * }
 * 
 * Para un usuario sin permisos:
 * {
 *   success: true,
 *   isAdmin: false,
 *   role: 'user',
 *   user: 'cliente1',
 *   email: 'cliente@email.com'
 * }
 * 
 * Para credenciales incorrectas:
 * {
 *   success: false,
 *   error: 'Credenciales incorrectas'
 * }
 */

// ============================================
// PERMISOS POR ROL
// ============================================

const permissions = {
  admin: {
    canAccessIntranet: true,
    canViewAllStatistics: true,
    canViewAllRoutes: true,
    canCreateRoutes: true,
    canEditAllRoutes: true,
    canDeleteRoutes: true,
    canManageUsers: true,
    canManageAgencies: true,
    canConfigureSystem: true,
    canViewDocuments: true,
    canManageSchedules: true,
    canBulkEdit: true,
    canExportData: true
  },
  agency: {
    canAccessIntranet: true,
    canViewAllStatistics: false,      // Solo sus propias estadísticas
    canViewAllRoutes: false,          // Solo sus propias rutas
    canCreateRoutes: true,            // Puede crear sus propias rutas
    canEditAllRoutes: false,          // Solo editar sus propias rutas
    canDeleteRoutes: false,           // Solo desactivar, no eliminar
    canManageUsers: false,
    canManageAgencies: false,
    canConfigureSystem: false,
    canViewDocuments: false,
    canManageSchedules: true,         // Sus propios horarios
    canBulkEdit: false,
    canExportData: true               // Sus propios datos
  },
  user: {
    canAccessIntranet: false,
    // ... todos false
  }
};

// ============================================
// ESTRUCTURA DE RUTAS CON AGENCIA
// ============================================

const exampleRoute = {
  id: 1,
  code: 'MAD-BCN-001',
  origin: 'Madrid',
  destination: 'Barcelona',
  type: 'express',
  duration: 240,
  price: 25.00,
  capacity: 50,
  occupied: 46,
  status: 'active',
  agencyId: 'AG001',              // ID de la agencia que gestiona esta ruta
  agencyName: 'Viajes Norte',     // Nombre de la agencia (opcional, para mostrar)
  createdAt: '2025-01-10T08:00:00Z',
  updatedAt: '2025-01-13T15:30:00Z'
};

// ============================================
// EJEMPLO DE FILTRADO EN BACKEND
// ============================================

/**
 * Ejemplo de endpoint para obtener rutas:
 * 
 * GET /api/routes?userId={userId}&role={role}&agencyId={agencyId}
 * 
 * El backend debe filtrar:
 * - Si role === 'admin': Devolver todas las rutas
 * - Si role === 'agency': Devolver solo routes donde route.agencyId === agencyId
 * - Si role === 'user': No tiene acceso
 */

// ============================================
// INTEGRACIÓN CON BASE DE DATOS
// ============================================

/**
 * Tablas necesarias en la base de datos:
 * 
 * 1. users
 *    - id (PK)
 *    - username
 *    - email
 *    - password_hash
 *    - role (admin|agency|user)
 *    - agency_id (FK, nullable)
 *    - status
 *    - created_at
 *    - updated_at
 * 
 * 2. agencies
 *    - id (PK)
 *    - name
 *    - email
 *    - phone
 *    - address
 *    - status
 *    - created_at
 *    - updated_at
 * 
 * 3. routes
 *    - id (PK)
 *    - code
 *    - origin
 *    - destination
 *    - type
 *    - duration
 *    - distance
 *    - price
 *    - capacity
 *    - agency_id (FK)
 *    - status
 *    - created_at
 *    - updated_at
 * 
 * 4. tickets
 *    - id (PK)
 *    - route_id (FK)
 *    - user_id (FK)
 *    - seat_number
 *    - price
 *    - status
 *    - purchase_date
 *    - travel_date
 */

export { exampleAgencies, permissions, exampleRoute };
