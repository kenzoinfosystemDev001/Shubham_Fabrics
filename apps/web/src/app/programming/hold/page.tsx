import { DepartmentHold } from '@/components/hold/DepartmentHold';

// Programming pages share the root layout, whose sidebar is fixed; the page keeps clear of it.
export default function Page() {
  return (
    <div className="pl-0 md:pl-64">
      <DepartmentHold departmentCode="PROGRAMMING" />
    </div>
  );
}
