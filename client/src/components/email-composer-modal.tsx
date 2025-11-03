import React from "react";
import { useState, useEffect } from "react";
import { X, Send, Loader2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  onSend: (subject: string, body: string) => Promise<void>;
  lastReceivedEmailSubject?: string;
}

export function EmailComposerModal({ lead, isOpen, onClose, onSend, lastReceivedEmailSubject }: EmailComposerModalProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isCheckingGrammar, setIsCheckingGrammar] = useState(false);
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
  }, [isOpen, lastReceivedEmailSubject]);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return;
    
    setIsSending(true);
    try {
      await onSend(subject, body);
      setSubject("");
      setBody("");
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" data-testid="modal-email-composer">
        <DialogHeader>
          <DialogTitle>Reply to {lead?.clientName}</DialogTitle>
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
            <Textarea
              id="body"
              placeholder="Type your message here..."
              className="min-h-64 font-mono text-sm resize-none"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              data-testid="textarea-body"
            />
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
