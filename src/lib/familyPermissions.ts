export interface SupervisorPermissions {
  can_edit: boolean;
  can_delete: boolean;
  can_moderate: boolean;
  can_style: boolean;
}

export type PermissionKey = keyof SupervisorPermissions;

export const SUPERVISOR_DEFAULT_PERMISSIONS: SupervisorPermissions = {
  can_edit: true,
  can_delete: false,
  can_moderate: true,
  can_style: false,
};

export const PERMISSION_OPTIONS: { key: PermissionKey; label: string }[] = [
  { key: 'can_edit', label: 'تعديل وإضافة أفراد' },
  { key: 'can_delete', label: 'حذف أفراد' },
  { key: 'can_moderate', label: 'مراجعة واعتماد الطلبات' },
  { key: 'can_style', label: 'تعديل تصميم وألوان الشجرة' },
];

export type CurrentUser =
  | { username: string; role: 'admin' }
  | ({
      username: string;
      role: 'supervisor';
      supervisorId: string | number;
    } & SupervisorPermissions);

export function getPermissions(user: CurrentUser | null): SupervisorPermissions {
  const isAdmin = user?.role === 'admin';
  return {
    can_edit: isAdmin || (user?.role === 'supervisor' && user.can_edit === true),
    can_delete: isAdmin || (user?.role === 'supervisor' && user.can_delete === true),
    can_moderate: isAdmin || (user?.role === 'supervisor' && user.can_moderate === true),
    can_style: isAdmin || (user?.role === 'supervisor' && user.can_style === true),
  };
}
