import { Card } from "~/components/admin/workspace";
import { Skeleton } from "~/components/ui/skeleton";

/**
 * Account sections are server-rendered because their values and access policy
 * come from the database. Keep the rail interactive while the next section is
 * being prepared, and reserve the form's shape so the page does not jump.
 */
export default function AccountSectionLoading() {
  return (
    <div aria-hidden className="grid gap-5">
      <Card>
        <div className="grid max-w-md gap-4">
          <div className="grid gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          <div className="grid gap-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
      </Card>
    </div>
  );
}
