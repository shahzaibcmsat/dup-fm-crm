import React from "react";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, FileSpreadsheet, CheckCircle2, Send, Server } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export default function Settings() {
  const [provider, setProvider] = useState<"sendgrid" | "microsoft" | "loading">("loading");
  const [sendgridConfigured, setSendgridConfigured] = useState<boolean | null>(null);
  const [microsoftConfigured, setMicrosoftConfigured] = useState<boolean | null>(null);
  const [sendgridFromEmail, setSendgridFromEmail] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/email/provider");
        const data = await res.json();
        setProvider(data.provider);
        setSendgridConfigured(!!data.sendgridConfigured);
        setMicrosoftConfigured(!!data.microsoftConfigured);
        // fetch from-email details for display
        const res2 = await fetch('/api/auth/status');
        const s = await res2.json();
        setSendgridFromEmail(s?.environment?.sendgridFromEmail || "");
      } catch (e) {
        setProvider("microsoft");
      }
    })();
  }, []);

  const onSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/email/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your integrations and preferences
        </p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Server className="w-4 h-4" /> Email Provider
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
              <div className="col-span-1">
                <p className="text-sm text-muted-foreground">Choose how emails are sent</p>
              </div>
              <div className="col-span-1">
                <Select value={provider === "loading" ? undefined : provider} onValueChange={(v: any) => setProvider(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sendgrid">SendGrid</SelectItem>
                    <SelectItem value="microsoft">Microsoft (Outlook)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 flex gap-2">
                <Button variant="default" onClick={onSave} disabled={provider === "loading" || saving}>
                  <Send className="w-4 h-4 mr-1" /> Apply
                </Button>
                {provider === "sendgrid" && (
                  <div className="flex items-center gap-2">
                    <Badge variant={sendgridConfigured ? "default" : "destructive"}>
                      SendGrid {sendgridConfigured ? "Configured" : "Not Configured"}
                    </Badge>
                    {sendgridFromEmail && (
                      <span className="text-xs text-muted-foreground">From: {sendgridFromEmail}</span>
                    )}
                  </div>
                )}
                {provider === "microsoft" && (
                  <Badge variant={microsoftConfigured ? "default" : "destructive"}>
                    Outlook {microsoftConfigured ? "Connected" : "Not Connected"}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Integrations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Outlook</p>
                  <p className="text-sm text-muted-foreground">Send and receive emails</p>
                </div>
              </div>
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Connected
              </Badge>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Google Sheets</p>
                  <p className="text-sm text-muted-foreground">Import leads from spreadsheets</p>
                </div>
              </div>
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Connected
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Lead Statuses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge variant="default">NEW</Badge>
              <Badge variant="secondary">CONTACTED</Badge>
              <Badge variant="outline">QUALIFIED</Badge>
              <Badge variant="secondary">FOLLOW-UP</Badge>
              <Badge variant="default">CLOSED WON</Badge>
              <Badge variant="outline">CLOSED LOST</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
