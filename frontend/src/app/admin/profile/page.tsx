'use client'
import ProfileTable from '@/components/admin/tableProfile';


export default function page() {
  return (
    <div className='flex-1 overflow-auto bg-white w-full rounded-2xl'>
      <ProfileTable />
    </div>
  )
}
