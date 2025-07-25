import React from 'react';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function StatusIcon({ status }) {
  switch (status) {
    case 'active':
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'running':
      return <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
    case 'error':
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
  }
} 