import { useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { notificationsApi } from '@/api/notifications'
import { tableProps, useList } from '@/hooks/useList'
import { formatDateTime } from '@/utils/formatters'
import type { Notification } from '@/types'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { SearchInput, Toolbar } from '@/components/common/SearchInput'
import { Badge } from '@/components/ui/badge'
import { NativeSelect } from '@/components/ui/native-select'

export function NotificationsPage() {
  const [status, setStatus] = useState('all')
  const [channel, setChannel] = useState('all')
  const list = useList<Notification>('notifications', notificationsApi.list, { filters: { status, channel } })

  const columns: ColumnDef<Notification>[] = [
    { accessorKey: 'created_at', header: 'Time', cell: ({ row }) => <span className="whitespace-nowrap">{formatDateTime(row.original.created_at)}</span> },
    { accessorKey: 'channel', header: 'Channel', cell: ({ row }) => <Badge variant="outline" className="uppercase">{row.original.channel}</Badge> },
    { id: 'to', header: 'To', cell: ({ row }) => row.original.recipient_phone || row.original.recipient_email || '-' },
    {
      accessorKey: 'message', header: 'Message',
      cell: ({ row }) => (
        <div className="max-w-md">
          {/* Codes and pass links are secrets; the log shows only that a message went out. */}
          <div className="truncate">{row.original.message.replace(/OTP: \d+/, 'OTP: ••••••').replace(/\/pass\/[0-9a-f-]+/, '/pass/…')}</div>
          {row.original.error_message && <div className="text-xs text-destructive break-words">{row.original.error_message}</div>}
        </div>
      ),
    },
    {
      accessorKey: 'status', header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'sent' ? 'default' : row.original.status === 'failed' ? 'destructive' : 'secondary'} className="capitalize">
          {row.original.status}
        </Badge>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Notifications" description="SMS and email messages sent by the system. Check here if someone says they did not get a message." />
      <Toolbar>
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search phone or email" />
        <NativeSelect aria-label="Filter by status" className="sm:w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </NativeSelect>
        <NativeSelect aria-label="Filter by channel" className="sm:w-40" value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="all">SMS and email</option>
          <option value="sms">SMS</option>
          <option value="email">Email</option>
        </NativeSelect>
      </Toolbar>
      <DataTable columns={columns} {...tableProps(list)} emptyMessage="No notifications yet." />
    </div>
  )
}
