/** 認證 API */
import { http } from './client'
import type { AdminMe, LoginResult } from './types'

export async function login(username: string, password: string): Promise<LoginResult> {
  return http.post<LoginResult>('/admin/login', { username, password })
}

export async function fetchMe(): Promise<AdminMe> {
  return http.get<AdminMe>('/admin/me')
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<{ message: string }> {
  return http.post<{ message: string }>('/admin/change-password', {
    old_password: oldPassword,
    new_password: newPassword,
  })
}
