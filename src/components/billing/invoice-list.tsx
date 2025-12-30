"use client";

import { format } from "date-fns";
import { Download, ExternalLink, FileText } from "lucide-react";
import type { Invoice } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface InvoiceListProps {
  invoices: Invoice[];
}

const formatCurrency = (amount: number, currency: string): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
};

const getStatusBadge = (status: Invoice["status"]) => {
  const variants: Record<
    Invoice["status"],
    { variant: "default" | "secondary" | "destructive" | "outline"; label: string }
  > = {
    paid: { variant: "default", label: "Paid" },
    open: { variant: "secondary", label: "Open" },
    draft: { variant: "outline", label: "Draft" },
    void: { variant: "outline", label: "Void" },
    uncollectible: { variant: "destructive", label: "Uncollectible" },
  };

  const { variant, label } = variants[status];
  return <Badge variant={variant}>{label}</Badge>;
};

export function InvoiceList({ invoices }: InvoiceListProps) {
  if (invoices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>Your billing history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No invoices yet</p>
            <p className="text-sm text-muted-foreground">Your invoices will appear here once you subscribe.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoices</CardTitle>
        <CardDescription>Your billing history and receipts</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell>{invoice.createdAt ? format(new Date(invoice.createdAt), "MMM d, yyyy") : "—"}</TableCell>
                <TableCell>
                  {invoice.periodStart && invoice.periodEnd ? (
                    <>
                      {format(new Date(invoice.periodStart), "MMM d")} -{" "}
                      {format(new Date(invoice.periodEnd), "MMM d, yyyy")}
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="font-medium">{formatCurrency(invoice.amount, invoice.currency)}</TableCell>
                <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {invoice.pdfUrl && (
                      <Button variant="ghost" size="icon" asChild>
                        <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer" title="Download PDF">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {invoice.hostedInvoiceUrl && (
                      <Button variant="ghost" size="icon" asChild>
                        <a
                          href={invoice.hostedInvoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View Invoice"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

interface InvoiceCardProps {
  invoice: Invoice;
}

export function InvoiceCard({ invoice }: InvoiceCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-4">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-medium">
              {invoice.createdAt ? format(new Date(invoice.createdAt), "MMMM d, yyyy") : "Invoice"}
            </p>
            <p className="text-sm text-muted-foreground">{formatCurrency(invoice.amount, invoice.currency)}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {getStatusBadge(invoice.status)}
          {invoice.pdfUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer">
                <Download className="mr-2 h-4 w-4" />
                Download
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
