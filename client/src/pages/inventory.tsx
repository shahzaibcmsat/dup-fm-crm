import { useState, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AgGridReact } from "ag-grid-react";
import { ColDef, GridApi, GridReadyEvent, ModuleRegistry } from "ag-grid-community";
import { AllCommunityModule } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Download, Plus, Trash2, Database, Bold, Type, Palette, FolderPlus, FolderMinus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import * as XLSX from "xlsx";

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface InventoryItem {
  id: number;
  product: string;
  boxes: string | null;
  sqFtPerBox: string | null;
  totalSqFt: string | null;
  productHeading: string | null;
  notes: string | null;
}

export default function InventoryPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const gridRef = useRef<AgGridReact>(null);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [fontSize, setFontSize] = useState("14");
  const [cellColor, setCellColor] = useState("#ffffff");
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false);
  const [showRemoveCategoryDialog, setShowRemoveCategoryDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryToRemove, setCategoryToRemove] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch inventory data
  const { data: inventory = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
  });

  // Extract unique categories from product headings
  const categories = useMemo(() => {
    const cats = new Set<string>();
    inventory.forEach(item => {
      if (item.productHeading) {
        cats.add(item.productHeading);
      }
    });
    return Array.from(cats).sort();
  }, [inventory]);

  // Filter data based on active tab
  const filteredInventory = useMemo(() => {
    if (activeTab === "all") return inventory;
    return inventory.filter(item => item.productHeading === activeTab);
  }, [inventory, activeTab]);

  // Column definitions
  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerCheckboxSelection: true,
        checkboxSelection: true,
        width: 50,
        pinned: 'left',
      },
      {
        headerName: "Product Heading",
        field: "productHeading",
        editable: true,
        cellStyle: (params) => {
          if (params.value) {
            return {
              backgroundColor: "#f0f0f0",
              fontWeight: "bold",
              fontSize: "13px",
            };
          }
          return {
            backgroundColor: "transparent",
            fontWeight: "normal",
            fontSize: "14px",
          };
        },
      },
      {
        headerName: "PRODUCT",
        field: "product",
        editable: true,
        flex: 2,
        cellStyle: (params) => {
          const isBold = params.data.notes?.includes("BOLD");
          const fontSize = params.data.notes?.match(/SIZE:(\d+)/)?.[1];
          const colorMatch = params.data.notes?.match(/COLOR:(#[0-9A-Fa-f]{6})/);
          const bgColor = colorMatch ? colorMatch[1] : undefined;
          
          return {
            fontWeight: isBold ? 'bold' : 'normal',
            fontSize: fontSize ? `${fontSize}px` : '14px',
            backgroundColor: bgColor || 'transparent',
          };
        },
      },
      {
        headerName: "Boxes",
        field: "boxes",
        editable: true,
        width: 120,
      },
      {
        headerName: "Sq Ft/box",
        field: "sqFtPerBox",
        editable: true,
        width: 120,
      },
      {
        headerName: "Tot Sq Ft",
        field: "totalSqFt",
        editable: true,
        width: 120,
      },
      {
        headerName: "Notes",
        field: "notes",
        editable: true,
        flex: 1,
        cellEditorPopup: true,
        tooltipField: "notes",
      },
    ],
    []
  );

  // Default column properties
  const defaultColDef = useMemo<ColDef>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      enableCellChangeFlash: true,
    }),
    []
  );

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (newItem: Partial<InventoryItem>) => {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newItem),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      // Return the created item for use in callbacks
      return data;
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (item: InventoryItem) => {
      const response = await fetch(`/api/inventory/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({ title: "Item updated successfully" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const response = await fetch("/api/inventory/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({ title: "Items deleted successfully" });
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/inventory/import", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({ title: "Import successful" });
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Migration mutation
  const migrationMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/migrate-inventory", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Migration failed");
      }
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return response.json();
      }
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({ 
        title: "✅ Database migrated successfully",
        description: "You can now import your Excel data"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Migration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
  }, []);

  const onCellValueChanged = useCallback(
    (event: any) => {
      const updatedItem = event.data as InventoryItem;
      if (updatedItem.id) {
        updateMutation.mutate(updatedItem);
      }
    },
    [updateMutation]
  );

  const handleAddRow = () => {
    // Get the currently selected row or focused cell
    const selectedRows = gridApi?.getSelectedRows() as InventoryItem[];
    const focusedCell = gridApi?.getFocusedCell();
    
    let targetProductHeading = activeTab !== "all" ? activeTab : null;
    let insertAfterId: number | string | null = null;

    // If a row is selected, get its category and ID
    if (selectedRows && selectedRows.length > 0) {
      const selectedRow = selectedRows[0];
      targetProductHeading = selectedRow?.productHeading || null;
      insertAfterId = selectedRow.id;
    } else if (focusedCell) {
      // If a cell is focused, get its row data
      const rowNode = gridApi?.getDisplayedRowAtIndex(focusedCell.rowIndex);
      if (rowNode?.data) {
        targetProductHeading = rowNode.data?.productHeading || null;
        insertAfterId = rowNode.data.id;
      }
    }

    const newItem = {
      product: "",
      boxes: null,
      sqFtPerBox: null,
      totalSqFt: null,
      productHeading: targetProductHeading,
      notes: null,
    };

    // Create the mutation
    createMutation.mutate(newItem, {
      onSuccess: (createdItem) => {
        // Store the insertAfterId for use after query refresh
        const targetId = insertAfterId;
        
        toast({ title: "Row added successfully" });
        
        // Wait for the query to refresh, then reorder rows if needed
        setTimeout(() => {
          if (!gridApi) return;
          
          // Get all current rows
          const allRows: InventoryItem[] = [];
          gridApi.forEachNode((node) => {
            if (node.data) allRows.push(node.data);
          });
          
          if (targetId && createdItem) {
            // Find the target row index
            const targetIndex = allRows.findIndex(row => row.id === targetId);
            const newRowIndex = allRows.findIndex(row => row.id === createdItem.id);
            
            if (targetIndex !== -1 && newRowIndex !== -1) {
              // Reorder: remove new row from its position and insert after target
              const reorderedRows = [...allRows];
              const [newRow] = reorderedRows.splice(newRowIndex, 1);
              // Insert ABOVE the target (at target index, not after)
              reorderedRows.splice(targetIndex, 0, newRow);
              
              // Update grid with reordered data
              gridApi.setGridOption('rowData', reorderedRows);
              
              // Select and scroll to the new row
              setTimeout(() => {
                gridApi.forEachNode((node, index) => {
                  if (node.data?.id === createdItem.id) {
                    node.setSelected(true);
                    gridApi.ensureIndexVisible(index, 'middle');
                  }
                });
              }, 50);
            }
          } else if (createdItem) {
            // No target specified, just select the new row
            gridApi.forEachNode((node) => {
              if (node.data?.id === createdItem.id) {
                node.setSelected(true);
                gridApi.ensureNodeVisible(node, 'middle');
              }
            });
          }
        }, 300);
      }
    });
  };

  const handleDeleteSelected = () => {
    const selectedRows = gridApi?.getSelectedRows() as InventoryItem[];
    if (selectedRows && selectedRows.length > 0) {
      const ids = selectedRows.map((row) => row.id);
      deleteMutation.mutate(ids);
    } else {
      toast({
        title: "No rows selected",
        description: "Please select rows to delete",
        variant: "destructive",
      });
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importMutation.mutate(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleExport = () => {
    const allRows: any[] = [];
    gridApi?.forEachNodeAfterFilterAndSort((node) => {
      allRows.push(node.data);
    });

    const ws = XLSX.utils.json_to_sheet(
      allRows.map((row) => ({
        "Product Heading": row.productHeading || "",
        PRODUCT: row.product,
        Boxes: row.boxes || "",
        "Sq Ft/box": row.sqFtPerBox || "",
        "Tot Sq Ft": row.totalSqFt || "",
        Notes: row.notes || "",
      }))
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, `inventory-${new Date().toISOString().split("T")[0]}.xlsx`);

    toast({ title: "Exported successfully" });
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const rows = text.split("\n").filter((row) => row.trim());
      
      const items = rows.map((row) => {
        const cells = row.split("\t");
        return {
          product: cells[0] || "",
          boxes: cells[1] || null,
          sqFtPerBox: cells[2] || null,
          totalSqFt: cells[3] || null,
          productHeading: cells[4] || null,
          notes: cells[5] || null,
        };
      });

      // Bulk create
      for (const item of items) {
        await createMutation.mutateAsync(item);
      }

      toast({ title: `Pasted ${items.length} rows successfully` });
    } catch (error) {
      toast({
        title: "Paste failed",
        description: "Unable to read clipboard",
        variant: "destructive",
      });
    }
  };

  const handleMakeBold = () => {
    // First check for selected rows (via checkbox)
    const selectedRows = gridApi?.getSelectedRows() as InventoryItem[];
    
    if (selectedRows && selectedRows.length > 0) {
      console.log("Selected rows:", selectedRows);
      selectedRows.forEach((row) => {
        const currentNotes = row.notes || "";
        let updatedNotes;
        
        // Toggle bold
        if (currentNotes.includes("BOLD")) {
          updatedNotes = currentNotes.replace(/BOLD/g, "").trim();
        } else {
          updatedNotes = `BOLD ${currentNotes}`.trim();
        }
        
        const updatedRow = { ...row, notes: updatedNotes };
        updateMutation.mutate(updatedRow);
      });
      toast({ title: `Toggled bold for ${selectedRows.length} items` });
      return;
    }
    
    // Check for focused cell (currently clicked cell)
    const focusedCell = gridApi?.getFocusedCell();
    if (focusedCell) {
      console.log("Focused cell:", focusedCell);
      const rowNode = gridApi?.getDisplayedRowAtIndex(focusedCell.rowIndex);
      if (rowNode && rowNode.data) {
        const row = rowNode.data as InventoryItem;
        const currentNotes = row.notes || "";
        let updatedNotes;
        
        if (currentNotes.includes("BOLD")) {
          updatedNotes = currentNotes.replace(/BOLD/g, "").trim();
        } else {
          updatedNotes = `BOLD ${currentNotes}`.trim();
        }
        
        const updatedRow = { ...row, notes: updatedNotes };
        updateMutation.mutate(updatedRow);
        toast({ title: "Toggled bold for 1 item" });
        return;
      }
    }
    
    // Check for cell ranges (dragged selection)
    const selectedCells = gridApi?.getCellRanges();
    if (selectedCells && selectedCells.length > 0) {
      console.log("Cell ranges:", selectedCells);
      const rows = new Set<InventoryItem>();
      selectedCells.forEach(range => {
        const startRow = Math.min(range.startRow?.rowIndex ?? 0, range.endRow?.rowIndex ?? 0);
        const endRow = Math.max(range.startRow?.rowIndex ?? 0, range.endRow?.rowIndex ?? 0);
        for (let i = startRow; i <= endRow; i++) {
          const node = gridApi?.getDisplayedRowAtIndex(i);
          if (node && node.data) {
            rows.add(node.data as InventoryItem);
          }
        }
      });
      
      if (rows.size > 0) {
        rows.forEach((row) => {
          const currentNotes = row.notes || "";
          let updatedNotes;
          
          if (currentNotes.includes("BOLD")) {
            updatedNotes = currentNotes.replace(/BOLD/g, "").trim();
          } else {
            updatedNotes = `BOLD ${currentNotes}`.trim();
          }
          
          const updatedRow = { ...row, notes: updatedNotes };
          updateMutation.mutate(updatedRow);
        });
        toast({ title: `Toggled bold for ${rows.size} items` });
        return;
      }
    }
    
    toast({
      title: "No selection",
      description: "Please select rows or cells to format",
      variant: "destructive",
    });
  };

  const handleChangeFontSize = () => {
    const selectedRows = gridApi?.getSelectedRows() as InventoryItem[];
    const selectedCells = gridApi?.getCellRanges();
    
    if (selectedRows && selectedRows.length > 0) {
      selectedRows.forEach((row) => {
        let currentNotes = row.notes || "";
        currentNotes = currentNotes.replace(/SIZE:\d+/g, "").trim();
        const updatedRow = { ...row, notes: `${currentNotes} SIZE:${fontSize}`.trim() };
        updateMutation.mutate(updatedRow);
      });
      toast({ title: `Applied font size ${fontSize}px to ${selectedRows.length} items` });
    } else if (selectedCells && selectedCells.length > 0) {
      const rows = new Set<InventoryItem>();
      selectedCells.forEach(range => {
        const startRow = Math.min(range.startRow?.rowIndex ?? 0, range.endRow?.rowIndex ?? 0);
        const endRow = Math.max(range.startRow?.rowIndex ?? 0, range.endRow?.rowIndex ?? 0);
        for (let i = startRow; i <= endRow; i++) {
          const node = gridApi?.getDisplayedRowAtIndex(i);
          if (node) {
            rows.add(node.data as InventoryItem);
          }
        }
      });
      
      rows.forEach((row) => {
        let currentNotes = row.notes || "";
        currentNotes = currentNotes.replace(/SIZE:\d+/g, "").trim();
        const updatedRow = { ...row, notes: `${currentNotes} SIZE:${fontSize}`.trim() };
        updateMutation.mutate(updatedRow);
      });
      toast({ title: `Applied font size ${fontSize}px to ${rows.size} items` });
    } else {
      toast({
        title: "No selection",
        description: "Please select rows or cells to format",
        variant: "destructive",
      });
    }
  };

  const handleRemoveFormatting = () => {
    const selectedRows = gridApi?.getSelectedRows() as InventoryItem[];
    const selectedCells = gridApi?.getCellRanges();
    
    if (selectedRows && selectedRows.length > 0) {
      selectedRows.forEach((row) => {
        let currentNotes = row.notes || "";
        currentNotes = currentNotes.replace(/BOLD/g, "").replace(/SIZE:\d+/g, "").trim();
        const updatedRow = { ...row, notes: currentNotes };
        updateMutation.mutate(updatedRow);
      });
      toast({ title: `Removed formatting from ${selectedRows.length} items` });
    } else if (selectedCells && selectedCells.length > 0) {
      const rows = new Set<InventoryItem>();
      selectedCells.forEach(range => {
        const startRow = Math.min(range.startRow?.rowIndex ?? 0, range.endRow?.rowIndex ?? 0);
        const endRow = Math.max(range.startRow?.rowIndex ?? 0, range.endRow?.rowIndex ?? 0);
        for (let i = startRow; i <= endRow; i++) {
          const node = gridApi?.getDisplayedRowAtIndex(i);
          if (node) {
            rows.add(node.data as InventoryItem);
          }
        }
      });
      
      rows.forEach((row) => {
        let currentNotes = row.notes || "";
        currentNotes = currentNotes.replace(/BOLD/g, "").replace(/SIZE:\d+/g, "").trim();
        const updatedRow = { ...row, notes: currentNotes };
        updateMutation.mutate(updatedRow);
      });
      toast({ title: `Removed formatting from ${rows.size} items` });
    } else {
      toast({
        title: "No selection",
        description: "Please select rows or cells to format",
        variant: "destructive",
      });
    }
  };

  const handleApplyColor = () => {
    const applyToRows = (rows: InventoryItem[]) => {
      rows.forEach((row) => {
        let currentNotes = row.notes || "";
        currentNotes = currentNotes.replace(/COLOR:#[0-9A-Fa-f]{6}/g, "").trim();
        const updatedRow = { ...row, notes: `${currentNotes} COLOR:${cellColor}`.trim() };
        updateMutation.mutate(updatedRow);
      });
    };

    const selectedRows = gridApi?.getSelectedRows() as InventoryItem[];
    if (selectedRows && selectedRows.length > 0) {
      applyToRows(selectedRows);
      toast({ title: `Applied color to ${selectedRows.length} items` });
      return;
    }

    const focusedCell = gridApi?.getFocusedCell();
    if (focusedCell) {
      const rowNode = gridApi?.getDisplayedRowAtIndex(focusedCell.rowIndex);
      if (rowNode?.data) {
        applyToRows([rowNode.data]);
        toast({ title: "Applied color to 1 item" });
        return;
      }
    }

    toast({
      title: "No selection",
      description: "Please select rows to format",
      variant: "destructive",
    });
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) {
      toast({
        title: "Invalid name",
        description: "Category name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    if (categories.includes(newCategoryName.trim())) {
      toast({
        title: "Category exists",
        description: "This category already exists",
        variant: "destructive",
      });
      return;
    }

    // Create a new row with the category heading
    const newRow: Partial<InventoryItem> = {
      productHeading: newCategoryName.trim(),
      product: "",
      boxes: null,
      sqFtPerBox: null,
      totalSqFt: null,
      notes: null,
    };

    createMutation.mutate(newRow as InventoryItem);
    setNewCategoryName("");
    setShowAddCategoryDialog(false);
    setActiveTab(newCategoryName.trim());
    toast({ title: "Category added successfully" });
  };

  const handleRemoveCategory = () => {
    if (!categoryToRemove) return;

    // Get all items in this category
    const itemsToDelete = inventory.filter(i => i.productHeading === categoryToRemove);
    
    if (itemsToDelete.length === 0) {
      toast({
        title: "No items found",
        description: "This category has no items",
        variant: "destructive",
      });
      setShowRemoveCategoryDialog(false);
      return;
    }

    // Delete all items in this category
    const itemIds = itemsToDelete.map(item => item.id);
    deleteMutation.mutate(itemIds);
    
    setShowRemoveCategoryDialog(false);
    setCategoryToRemove(null);
    setActiveTab("all");
    toast({ 
      title: "Category removed", 
      description: `Deleted ${itemsToDelete.length} items from ${categoryToRemove}` 
    });
  };

  return (
    <div className="h-screen flex p-6 gap-4">
      {/* Vertical Tabs Sidebar */}
      <div className="w-64 flex-shrink-0 bg-card rounded-lg border p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Categories</h2>
          <div className="flex gap-1">
            <Button
              onClick={() => setShowAddCategoryDialog(true)}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Add Category"
            >
              <FolderPlus className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => {
                if (activeTab === "all") {
                  toast({
                    title: "Select a category",
                    description: "Please select a category from the list to remove",
                    variant: "destructive",
                  });
                  return;
                }
                setCategoryToRemove(activeTab);
                setShowRemoveCategoryDialog(true);
              }}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Remove Category"
            >
              <FolderMinus className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setActiveTab("all")}
            className={`w-full text-left rounded-full px-4 py-3 transition-colors ${
              activeTab === "all"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent"
            }`}
          >
            <span className="font-medium">All ({inventory.length})</span>
          </button>
          {categories.map(category => {
            const count = inventory.filter(i => i.productHeading === category).length;
            const shortName = category.length > 18 ? category.substring(0, 18) + '...' : category;
            return (
              <button
                key={category}
                onClick={() => setActiveTab(category)}
                title={category}
                className={`w-full text-left rounded-full px-4 py-3 transition-colors ${
                  activeTab === category
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent"
                }`}
              >
                <span className="font-medium text-sm">{shortName} ({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col space-y-4 min-w-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Inventory</h1>
            {inventory.length === 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                ⚠️ Database not migrated yet. Click "Migrate Database" first.
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleAddRow} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add New Row
            </Button>
            <Button onClick={handleDeleteSelected} variant="destructive" size="sm">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImport}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              size="sm"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
            <Button onClick={handleExport} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Formatting Toolbar */}
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg flex-wrap">
          <Label className="text-sm font-semibold">Format:</Label>
          <Button onClick={handleMakeBold} variant="outline" size="sm">
            <Bold className="w-4 h-4 mr-2" />
            Toggle Bold
          </Button>
          <div className="flex items-center gap-2">
            <Label htmlFor="fontSize" className="text-sm">Size:</Label>
            <Input
              id="fontSize"
              type="number"
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value)}
              className="w-16 h-8"
              min="10"
              max="32"
            />
            <Button onClick={handleChangeFontSize} variant="outline" size="sm">
              <Type className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="cellColor" className="text-sm">Color:</Label>
            <Input
              id="cellColor"
              type="color"
              value={cellColor}
              onChange={(e) => setCellColor(e.target.value)}
              className="w-12 h-8 p-1"
            />
            <Button onClick={handleApplyColor} variant="outline" size="sm">
              <Palette className="w-4 h-4" />
            </Button>
          </div>
          <Button onClick={handleRemoveFormatting} variant="outline" size="sm">
            Clear
          </Button>
        </div>

        {/* Grid Content */}
        <div className="ag-theme-alpine" style={{ height: 'calc(100vh - 300px)', width: '100%' }}>
          <AgGridReact
            ref={gridRef}
            rowData={filteredInventory}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onGridReady={onGridReady}
            onCellValueChanged={onCellValueChanged}
            rowSelection="multiple"
            animateRows={true}
            enableRangeSelection={true}
            enableFillHandle={true}
            undoRedoCellEditing={true}
            undoRedoCellEditingLimit={20}
            enableCellTextSelection={true}
            ensureDomOrder={true}
            suppressRowClickSelection={false}
            loading={isLoading}
          />
        </div>

        <div className="text-sm text-muted-foreground">
          <p>💡 Tips: Select rows with checkboxes • Click cells to edit • Use formatting toolbar above • Copy/paste from Excel</p>
        </div>
      </div>

      {/* Add Category Dialog */}
      <Dialog open={showAddCategoryDialog} onOpenChange={setShowAddCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
            <DialogDescription>
              Create a new product category. This will add a new category heading to the inventory.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="categoryName">Category Name</Label>
              <Input
                id="categoryName"
                placeholder="e.g., New Collection"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddCategory();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddCategoryDialog(false);
              setNewCategoryName("");
            }}>
              Cancel
            </Button>
            <Button onClick={handleAddCategory}>Add Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Category Dialog */}
      <Dialog open={showRemoveCategoryDialog} onOpenChange={setShowRemoveCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Category</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove "{categoryToRemove}"? This will delete all {inventory.filter(i => i.productHeading === categoryToRemove).length} items in this category.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowRemoveCategoryDialog(false);
              setCategoryToRemove(null);
            }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemoveCategory}>
              Remove Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
