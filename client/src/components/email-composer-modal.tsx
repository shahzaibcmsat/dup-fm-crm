import React from "react";
import { useState, useEffect } from "react";
import { X, Send, Loader2, Sparkles, Paperclip } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Lead } from "@shared/schema";
import { fixGrammar } from "@/lib/grammar";
import { useToast } from "@/hooks/use-toast";

interface EmailComposerModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onSend: (subject: string, body: string, attachments?: Array<{ filename: string; content: string; mimeType: string }>) => Promise<void>;
  lastReceivedEmailSubject?: string;
}

export function EmailComposerModal({ lead, isOpen, onClose, onSend, lastReceivedEmailSubject }: EmailComposerModalProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<Array<{ filename: string; content: string; mimeType: string }>>([]);
  const [isSending, setIsSending] = useState(false);
  const [isCheckingGrammar, setIsCheckingGrammar] = useState(false);
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const { toast } = useToast();

  // Auto-populate subject when replying to a received email
  useEffect(() => {
    if (isOpen && lastReceivedEmailSubject) {
      // Check if the subject already has "Re:" prefix
      const subjectWithReply = lastReceivedEmailSubject.startsWith("Re:") 
        ? lastReceivedEmailSubject 
        : `Re: ${lastReceivedEmailSubject}`;
      setSubject(subjectWithReply);
    } else if (isOpen && !lastReceivedEmailSubject) {
      // Clear subject if opening for a new email (no reply context)
      setSubject("");
    }
    
    // Always clear body and attachments when opening modal for a new lead
    if (isOpen) {
      setBody("");
      setAttachments([]);
    }
  }, [isOpen, lastReceivedEmailSubject]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: Array<{ filename: string; content: string; mimeType: string }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Limit file size to 5MB
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 5MB limit`,
          variant: "destructive",
        });
        continue;
      }

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(file);
      });

      const base64Content = await base64Promise;
      newAttachments.push({
        filename: file.name,
        content: base64Content,
        mimeType: file.type || 'application/octet-stream',
      });
    }

    setAttachments([...attachments, ...newAttachments]);
    e.target.value = ''; // Reset input
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return;
    
    setIsSending(true);
    try {
      await onSend(subject, body, attachments.length > 0 ? attachments : undefined);
      setSubject("");
      setBody("");
      setAttachments([]);
      onClose();
    } finally {
      setIsSending(false);
    }
  };

  const handleCheckGrammar = async () => {
    if (!body.trim()) {
      toast({
        title: "No content to check",
        description: "Please type some message content first.",
        variant: "destructive",
      });
      return;
    }

    setIsCheckingGrammar(true);
    try {
      const result = await fixGrammar(body);
      
      if (result.text !== body) {
        setBody(result.text);
        
        // Show suggestions if any
        if (result.suggestions && result.suggestions.length > 0) {
          toast({
            title: "✨ Grammar improved!",
            description: result.suggestions.slice(0, 3).join(" • "),
          });
        } else {
          toast({
            title: "✨ Grammar improved!",
            description: "Your text has been refined for clarity and professionalism.",
          });
        }
      } else {
        toast({
          title: "Looks great!",
          description: "No grammar issues detected.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Grammar check failed",
        description: error.message || "Unable to check grammar. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCheckingGrammar(false);
    }
  };

  const handleGenerateAutoReply = async () => {
    if (!lead) return;

    setIsGeneratingReply(true);
    try {
      const response = await fetch('/api/emails/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          currentDraft: body.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate reply');
      }

      const result = await response.json();
      
      // Set the generated content
      if (result.subject && !subject.trim()) {
        setSubject(result.subject);
      }
      setBody(result.body);
      
      toast({
        title: "🤖 AI Reply Generated!",
        description: "Review and edit the generated email before sending.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to generate reply",
        description: error.message || "Unable to generate auto-reply. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingReply(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" data-testid="modal-email-composer">
        <DialogHeader>
          <DialogTitle>Reply to {lead?.clientName}</DialogTitle>
          <DialogDescription>
            Compose and send an email response to this lead
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input 
              id="to" 
              value={lead?.email || ""} 
              disabled 
              className="bg-muted"
              data-testid="input-to-email"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder="Enter email subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              data-testid="input-subject"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="body">Message</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateAutoReply}
                  disabled={isGeneratingReply || isSending}
                  className="h-8 text-xs"
                  title="Generate AI-powered reply based on lead details and conversation history"
                >
                  {isGeneratingReply ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 mr-1" />
                      AI Auto-Reply
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCheckGrammar}
                  disabled={isCheckingGrammar || isSending || !body.trim()}
                  className="h-8 text-xs"
                >
                  {isCheckingGrammar ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 mr-1" />
                      Check Grammar
                    </>
                  )}
                </Button>
              </div>
            </div>
            <Textarea
              id="body"
              placeholder="Type your message here..."
              className="min-h-64 font-mono text-sm resize-none"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              data-testid="textarea-body"
            />
          </div>

          {/* Attachments Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Attachments (Optional)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('file-input')?.click()}
                disabled={isSending}
                className="h-8 text-xs"
              >
                <Paperclip className="w-3 h-3 mr-1" />
                Add Files
              </Button>
              <input
                id="file-input"
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
            {attachments.length > 0 && (
              <div className="space-y-1">
                {attachments.map((att, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                    <span className="flex items-center gap-2">
                      <Paperclip className="w-3 h-3" />
                      {att.filename}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAttachment(idx)}
                      disabled={isSending}
                      className="h-6 text-xs"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isSending}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSend}
            disabled={isSending || !subject.trim() || !body.trim()}
            data-testid="button-send"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
