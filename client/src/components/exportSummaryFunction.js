// Function to add to Transcription.js component
const exportSummaryToFile = useCallback(() => {
  if (!summary) {
    setError("No summary available to export.");
    setSnackbarMessage("No summary available to export.");
    setSnackbarOpen(true);
    return;
  }

  try {
    // Generate formatted summary content using the API utility
    const formattedSummary = transcriptionAPI.exportSummary(summary, meetingTitle);
    
    // Create a Blob with the content
    const blob = new Blob([formattedSummary], { type: 'text/plain' });
    
    // Create a sanitized filename from meeting title or use a default
    const sanitizedTitle = meetingTitle 
      ? meetingTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() 
      : 'meeting';
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `${sanitizedTitle}_summary_${date}.txt`;
    
    // Create a download link and trigger it
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    // Show success notification
    setSnackbarMessage("Summary exported successfully!");
    setSnackbarOpen(true);
    console.log(`Summary exported successfully as ${filename}`);
  } catch (error) {
    console.error('Error exporting summary:', error);
    setError(`Failed to export summary: ${error.message}`);
    setSnackbarMessage("Failed to export summary. Please try again.");
    setSnackbarOpen(true);
  }
}, [summary, meetingTitle, setError, setSnackbarMessage, setSnackbarOpen]);
