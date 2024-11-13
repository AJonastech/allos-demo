'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ColumnStats {
    name: string;
    uniqueValues: { value: string; count: number }[];
    type: 'discrete' | 'continuous' | 'index';
}

const DataAnalyticsPage = () => {
    const [data, setData] = useState<string[][]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedColumn, setSelectedColumn] = useState<ColumnStats | null>(null);
    const [isColumnDialogOpen, setIsColumnDialogOpen] = useState(false);
    const [newColumnName, setNewColumnName] = useState('');
    const [isNaNModalOpen, setIsNaNModalOpen] = useState(false);
    const [isDiscretizeModalOpen, setIsDiscretizeModalOpen] = useState(false);
    const [selectedColumnsForNaN, setSelectedColumnsForNaN] = useState<string[]>([]);
    const [uniqueValues, setUniqueValues] = useState<Set<string>>(new Set());
    const [selectedValues, setSelectedValues] = useState<Set<string>>(new Set());
    const [selectedColumnsForDiscretize, setSelectedColumnsForDiscretize] = useState<string[]>([]);
    const [binSettings, setBinSettings] = useState<Record<string, {
        type: 'size' | 'count' | 'custom',
        value: number | number[]
    }>>({});
    const [isColumnOperationsOpen, setIsColumnOperationsOpen] = useState(false);
const [selectedColumnsForOperations, setSelectedColumnsForOperations] = useState<string[]>([]);
const [operationSettings, setOperationSettings] = useState<{
    singleColumn: {
        operation: 'power' | 'exponential' | 'logarithm';
        operationNumber: number;
        prefactor: number;
    };
    multiColumn: {
        prefactors: Record<string, number>;
        operations: string[];
    };
}>({
    singleColumn: {
        operation: 'power',
        operationNumber: 1,
        prefactor: 1
    },
    multiColumn: {
        prefactors: {},
        operations: []
    }
});

    const itemsPerPage = 50;

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                const rows = text.split('\n').map(row => row.split(','));
                setColumns(rows[0]);
                setData(rows.slice(1));
            };
            reader.readAsText(file);
        }
    };

    const downloadCSV = () => {
        const csv = [columns.join(','), ...data.map(row => row.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'data.csv';
        a.click();
    };

    const getColumnType = (columnIndex: number): 'discrete' | 'continuous' | 'index' => {
        const values = data.map(row => row[columnIndex]);
        const uniqueValues = new Set(values);
        if (uniqueValues.size === data.length) return 'index';
        if (uniqueValues.size < 10) return 'discrete';
        return 'continuous';
    };

    


    const getColumnStats = (columnIndex: number): ColumnStats => {
        const values = data.map(row => row[columnIndex]);
        const uniqueValues = [...new Set(values)];
        const valueCount = uniqueValues.map(value => ({
            value,
            count: values.filter(v => v === value).length
        }));

        let type: 'discrete' | 'continuous' | 'index';
        if (uniqueValues.length === data.length) {
            type = 'index';
        } else if (uniqueValues.length < 10) {
            type = 'discrete';
        } else {
            type = 'continuous';
        }

        return {
            name: columns[columnIndex],
            uniqueValues: valueCount,
            type
        };
    };



const handleNaNRemoval = () => {
    const allUniqueValues = new Set<string>();
    selectedColumnsForNaN.forEach(column => {
        const columnIndex = columns.indexOf(column);
        const values = data.map(row => {
            const value = row[columnIndex];
            // Convert potential number strings to actual numbers for comparison
            return isNaN(Number(value)) ? value : Number(value).toString();
        });
        values.forEach(value => allUniqueValues.add(value));
    });
    setUniqueValues(allUniqueValues);
};

const applyNaNRemoval = () => {
    const newData = data.filter(row => {
        return !selectedColumnsForNaN.some(column => {
            const columnIndex = columns.indexOf(column);
            const value = row[columnIndex];
            // Convert value to number if possible for comparison
            const normalizedValue = isNaN(Number(value)) ? value : Number(value).toString();
            return selectedValues.has(normalizedValue);
        });
    });
    setData(newData);
    setIsNaNModalOpen(false);
    // Reset selections
    setSelectedValues(new Set());
    setSelectedColumnsForNaN([]);
    setUniqueValues(new Set());
};
  
    const handleColumnClick = (columnIndex: number) => {
        setSelectedColumn(getColumnStats(columnIndex));
        setIsColumnDialogOpen(true);
        setNewColumnName(columns[columnIndex]);
    };

    const handleColumnRename = () => {
        if (selectedColumn && newColumnName) {
            const newColumns = [...columns];
            const index = columns.indexOf(selectedColumn.name);
            newColumns[index] = newColumnName;
            setColumns(newColumns);
            setIsColumnDialogOpen(false);
        }
    };

    const discretizeColumn = (columnName: string, settings: typeof binSettings[string]) => {
        const columnIndex = columns.indexOf(columnName);
        const values = data.map(row => parseFloat(row[columnIndex]));
        let bins: number[];

        if (settings.type === 'size') {
            const binSize = settings.value as number;
            const min = Math.min(...values);
            const max = Math.max(...values);
            bins = Array.from({ length: Math.ceil((max - min) / binSize) }, (_, i) => min + i * binSize);
        } else if (settings.type === 'count') {
            const binCount = settings.value as number;
            const sortedValues = [...values].sort((a, b) => a - b);
            bins = Array.from({ length: binCount + 1 }, (_, i) => 
                sortedValues[Math.floor(i * sortedValues.length / binCount)]);
        } else {
            bins = settings.value as number[];
        }

        const newData = data.map(row => {
            const value = parseFloat(row[columnIndex]);
            const binIndex = bins.findIndex((bin, i) => value >= bin && (!bins[i + 1] || value < bins[i + 1]));
            return [...row.slice(0, columnIndex), binIndex.toString(), ...row.slice(columnIndex + 1)];
        });

        setData(newData);
    };

    const applySingleColumnOperation = () => {
        const columnIndex = columns.indexOf(selectedColumnsForOperations[0]);
        const { operation, operationNumber, prefactor } = operationSettings.singleColumn;
    
        const newData = data.map(row => {
            const value = parseFloat(row[columnIndex]);
            if (isNaN(value)) return row;
    
            let result = value;
            switch (operation) {
                case 'power':
                    result = Math.pow(value, operationNumber);
                    break;
                case 'exponential':
                    result = Math.pow(operationNumber, value);
                    break;
                case 'logarithm':
                    result = Math.log(value) / Math.log(operationNumber);
                    break;
            }
            result *= prefactor;
    
            return [...row.slice(0, columnIndex), result.toString(), ...row.slice(columnIndex + 1)];
        });
    
        setData(newData);
        setIsColumnOperationsOpen(false);
    };
    
    const applyMultiColumnOperation = () => {
        const columnIndices = selectedColumnsForOperations.map(col => columns.indexOf(col));
        const { prefactors, operations } = operationSettings.multiColumn;
    
        const newData = data.map(row => {
            let result = parseFloat(row[columnIndices[0]]) * (prefactors[selectedColumnsForOperations[0]] || 1);
    
            for (let i = 1; i < columnIndices.length; i++) {
                const currentValue = parseFloat(row[columnIndices[i]]) * (prefactors[selectedColumnsForOperations[i]] || 1);
                
                switch (operations[i - 1]) {
                    case '+':
                        result += currentValue;
                        break;
                    case '-':
                        result -= currentValue;
                        break;
                    case '*':
                        result *= currentValue;
                        break;
                    case '/':
                        result = currentValue !== 0 ? result / currentValue : NaN;
                        break;
                }
            }
    
            return [...row.slice(0, columnIndices[0]), 
                    isNaN(result) ? 'NaN' : result.toString(), 
                    ...row.slice(columnIndices[0] + 1)];
        });
    
        setData(newData);
        setIsColumnOperationsOpen(false);
    };
    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex flex-col space-y-4 sm:space-y-6 md:space-y-0 md:flex-row md:justify-between md:items-center">
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:space-x-2">
                    <Button 
                        className="w-full sm:w-auto"
                        onClick={() => document.getElementById('fileInput')?.click()}
                    >
                        <span className="hidden sm:inline">Upload CSV</span>
                        <span className="sm:hidden">Upload</span>
                    </Button>
                    <input
                        id="fileInput"
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleFileUpload}
                    />
                    <Button 
                        className="w-full sm:w-auto"
                        disabled={data.length===0} 
                        onClick={downloadCSV}
                    >
                        <span className="hidden sm:inline">Download CSV</span>
                        <span className="sm:hidden">Download</span>
                    </Button>
                    <Button 
                        className="w-full sm:w-auto"
                        disabled={data.length===0} 
                        onClick={() => setIsNaNModalOpen(true)}
                    >
                        <span className="hidden sm:inline">Remove NaNs</span>
                        <span className="sm:hidden">NaNs</span>
                    </Button>
                    <Button 
                        className="w-full sm:w-auto"
                        disabled={data.length===0}  
                        onClick={() => setIsDiscretizeModalOpen(true)}
                    >
                        <span className="hidden sm:inline">Discretize Columns</span>
                        <span className="sm:hidden">Discretize</span>
                    </Button>
                </div>

                <Button 
                    className="w-full sm:w-auto"
                    disabled={data.length===0} 
                    onClick={() => setIsColumnOperationsOpen(true)}
                >
                    <span className="hidden sm:inline">Column Operations</span>
                    <span className="sm:hidden">Operations</span>
                </Button>

                <div className="flex items-center justify-center space-x-2">
                    <Button
                        variant="outline"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-2 sm:px-4"
                    >
                        <span className="hidden sm:inline">Previous</span>
                        <span className="sm:hidden">←</span>
                    </Button>
                    <span className="text-sm sm:text-base">Page {currentPage}</span>
                    <Button
                        variant="outline"
                        onClick={() => setCurrentPage(p => p + 1)}
                        disabled={currentPage * itemsPerPage >= data.length}
                        className="px-2 sm:px-4"
                    >
                        <span className="hidden sm:inline">Next</span>
                        <span className="sm:hidden">→</span>
                    </Button>
                </div>
            </div>


         
            {data.length === 0 ? (
                <Card className="flex flex-col items-center justify-center p-12 text-center">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.5 }}
                    >
                        <svg
                            className="w-32 h-32 text-gray-400 mb-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <motion.path 
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2z"
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ duration: 2, ease: "easeInOut" }}
                            />
                        </svg>
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                        >
                            <h3 className="text-2xl font-semibold mb-2">No Data to Preview</h3>
                            <p className="text-gray-500 mb-4">Upload a CSV file to get started with your data analysis</p>
                            <Button 
                                variant="outline"
                                onClick={() => document.getElementById('fileInput')?.click()}
                                className="hover:bg-blue-50 transition-colors"
                            >
                                <span className="mr-2">📊</span>
                                Upload CSV File
                            </Button>
                        </motion.div>
                    </motion.div>
                </Card>
            ):    <Card>
            <CardHeader>
                <CardTitle>Data Preview</CardTitle>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[600px] w-full">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {columns.map((column, index) => (
                                    <TableHead
                                        key={index}
                                        className="cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleColumnClick(index)}
                                    >
                                        {column}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data
                                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                .map((row, rowIndex) => (
                                    <TableRow key={rowIndex}>
                                        {row.map((cell: string, cellIndex: number) => (
                                            <TableCell key={cellIndex}>{cell}</TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </CardContent>
        </Card>}

            <AnimatePresence>
            {isColumnDialogOpen && (
                <motion.div
                    className="fixed inset-0 z-50 flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <motion.div 
                        className="fixed inset-0 bg-black/30 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsColumnDialogOpen(false)}
                    />
                    <motion.div 
                        className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[90vh] overflow-hidden"
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ type: "spring", duration: 0.3 }}
                    >
                        <div className="p-6 border-b">
                            <h2 className="text-xl font-semibold">Column: {selectedColumn?.name}</h2>
                            <button 
                                onClick={() => setIsColumnDialogOpen(false)}
                                className="absolute right-4 top-4 p-2 hover:bg-gray-100 rounded-full"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                            <div className="space-y-4">
                                <div className="flex items-center space-x-2">
                                    <Input
                                        value={newColumnName}
                                        onChange={(e) => setNewColumnName(e.target.value)}
                                        placeholder="New column name"
                                    />
                                    <Button onClick={handleColumnRename}>Rename</Button>
                                </div>
                                <div>
                                    <h3 className="font-semibold">Column Type: {selectedColumn?.type}</h3>
                                </div>
                                <div>
                                    <h3 className="font-semibold mb-2">Value Distribution</h3>
                                    <div className="space-y-2">
                                        {selectedColumn?.uniqueValues.map(({ value, count }) => (
                                            <div key={value} className="flex items-center space-x-2">
                                                <div className="w-24 truncate">{value}</div>
                                                <div className="flex-1 bg-gray-200 h-4 rounded">
                                                    <motion.div
                                                        className="bg-blue-500 h-full rounded"
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${(count / data.length) * 100}%` }}
                                                        transition={{ duration: 0.5 }}
                                                    />
                                                </div>
                                                <div className="w-16 text-right">{count}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}

                {isNaNModalOpen && (
                    <motion.div className="fixed inset-0 z-50 flex items-center justify-center">
                        <motion.div 
                            className="fixed inset-0 bg-black/30 backdrop-blur-sm"
                            onClick={() => setIsNaNModalOpen(false)}
                        />
                        <motion.div className="relative bg-white rounded-lg shadow-xl p-6 m-4 max-w-2xl w-full">
                            <h2 className="text-xl font-semibold mb-4">Remove Values</h2>
                            <div className="space-y-4">
                                <div>
                                    <h3 className="font-medium mb-2">Select Columns</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {columns.map(column => (
                                            <Button
                                                key={column}
                                                variant={selectedColumnsForNaN.includes(column) ? "default" : "outline"}
                                                onClick={() => {
                                                    setSelectedColumnsForNaN(prev => 
                                                        prev.includes(column) 
                                                            ? prev.filter(c => c !== column)
                                                            : [...prev, column]
                                                    );
                                                }}
                                            >
                                                {column}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                                
                                {selectedColumnsForNaN.length > 0 && (
                                    <div>
                                        <Button onClick={handleNaNRemoval}>Show Unique Values</Button>
                                        <div className="mt-4 max-h-60 overflow-y-auto">
                                            {Array.from(uniqueValues).map(value => (
                                                <div key={value} className="flex items-center space-x-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedValues.has(value)}
                                                        onChange={() => {
                                                            const newSelected = new Set(selectedValues);
                                                            if (newSelected.has(value)) {
                                                                newSelected.delete(value);
                                                            } else {
                                                                newSelected.add(value);
                                                            }
                                                            setSelectedValues(newSelected);
                                                        }}
                                                    />
                                                    <span>{value}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <Button className="mt-4" onClick={applyNaNRemoval}>Apply Removal</Button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                        </motion.div>
                )}

                {isDiscretizeModalOpen && (
                    <motion.div className="fixed inset-0 z-50 flex items-center justify-center">
                        <motion.div 
                            className="fixed inset-0 bg-black/30 backdrop-blur-sm"
                            onClick={() => setIsDiscretizeModalOpen(false)}
                        />
                        <motion.div className="relative bg-white rounded-lg shadow-xl p-6 m-4 max-w-2xl w-full">
                            <h2 className="text-xl font-semibold mb-4">Discretize Columns</h2>
                            <div className="space-y-4"></div>
                                <div className="flex flex-wrap gap-2">
                                    {columns.map((column, index) => {
                                        const type = getColumnType(index);
                                        return (
                                            <Button
                                                key={column}
                                                variant={selectedColumnsForDiscretize.includes(column) ? "default" : "outline"}
                                                disabled={type === 'discrete' || type === 'index'}
                                                className={`
                                                    ${type === 'discrete' && 'opacity-50'}
                                                    ${type === 'index' && 'text-red-500'}
                                                `}
                                                onClick={() => {
                                                    setSelectedColumnsForDiscretize(prev => 
                                                        prev.includes(column) 
                                                            ? prev.filter(c => c !== column)
                                                            : [...prev, column]
                                                    );
                                                }}
                                            >
                                                {column}
                                            </Button>
                                        );
                                    })}
                                </div>

                                {selectedColumnsForDiscretize.map(column => (
                                    <div key={column} className="border p-4 rounded-lg">
                                        <h3 className="font-medium mb-2">{column}</h3>
                                        <div className="space-y-2">
                                            <Input
                                                type="number"
                                                placeholder="Bin size"
                                                onChange={(e) => setBinSettings(prev => ({
                                                    ...prev,
                                                    [column]: { type: 'size', value: parseFloat(e.target.value) }
                                                }))}
                                            />
                                            <Input
                                                type="number"
                                                placeholder="Number of bins"
                                                onChange={(e) => setBinSettings(prev => ({
                                                    ...prev,
                                                    [column]: { type: 'count', value: parseFloat(e.target.value) }
                                                }))}
                                            />
                                            <Input
                                                placeholder="Custom bins (comma-separated)"
                                                onChange={(e) => setBinSettings(prev => ({
                                                    ...prev,
                                                    [column]: { 
                                                        type: 'custom', 
                                                        value: e.target.value.split(',').map(Number) 
                                                    }
                                                }))}
                                            />
                                        </div>
                                    </div>
                                ))}

                                {selectedColumnsForDiscretize.length > 0 && (
                                    <Button 
                                        onClick={() => {
                                            selectedColumnsForDiscretize.forEach(column => {
                                                if (binSettings[column]) {
                                                    discretizeColumn(column, binSettings[column]);
                                                }
                                            });
                                            setIsDiscretizeModalOpen(false);
                                        }}
                                    >
                                        Apply Discretization
                                    </Button>
                                )}
                     
                        </motion.div>
                        </motion.div>
                    
                )}

                {isColumnOperationsOpen && (
                    <motion.div className="fixed inset-0 z-50 flex items-center justify-center">
                        <motion.div 
                            className="fixed inset-0 bg-black/30 backdrop-blur-sm"
                            onClick={() => setIsColumnOperationsOpen(false)}
                        />
                        <motion.div className="relative bg-white rounded-lg shadow-xl p-6 m-4 max-w-2xl w-full">
                            <h2 className="text-xl font-semibold mb-4">Column Operations</h2>
                            
                            <div className="space-y-6">
                                <div>
                                    <h3 className="font-medium mb-2">Select Columns to Transform:</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {columns.map(column => (
                                            <Button
                                                key={column}
                                                variant={selectedColumnsForOperations.includes(column) ? "default" : "outline"}
                                                onClick={() => {
                                                    setSelectedColumnsForOperations(prev => 
                                                        prev.includes(column) 
                                                            ? prev.filter(c => c !== column)
                                                            : [...prev, column]
                                                    );
                                                }}
                                            >
                                                {column}
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                {selectedColumnsForOperations.length === 1 && (
                                    <div className="space-y-4 border-t pt-4">
                                        <h3 className="font-medium">Single Column Operation</h3>
                                        <div className="bg-blue-50 p-4 rounded-lg mb-4">
                                            <p className="text-sm text-blue-800">
                                                Current Formula: {selectedColumnsForOperations[0]} → 
                                                {operationSettings.singleColumn.prefactor} × 
                                                {operationSettings.singleColumn.operation === 'power' && `(${selectedColumnsForOperations[0]})^${operationSettings.singleColumn.operationNumber}`}
                                                {operationSettings.singleColumn.operation === 'exponential' && `${operationSettings.singleColumn.operationNumber}^(${selectedColumnsForOperations[0]})`}
                                                {operationSettings.singleColumn.operation === 'logarithm' && `log_{${operationSettings.singleColumn.operationNumber}}(${selectedColumnsForOperations[0]})`}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Operation Type</label>
                                                <select 
                                                    className="w-full p-2 border rounded"
                                                    value={operationSettings.singleColumn.operation}
                                                    onChange={(e) => setOperationSettings(prev => ({
                                                        ...prev,
                                                        singleColumn: {
                                                            ...prev.singleColumn,
                                                            operation: e.target.value as any
                                                        }
                                                    }))}
                                                >
                                                    <option value="power">Power (x^n)</option>
                                                    <option value="exponential">Exponential (n^x)</option>
                                                    <option value="logarithm">Logarithm (log_n(x))</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium mb-1">Operation Number (n)</label>
                                                <Input
                                                    type="number"
                                                    placeholder="Enter number"
                                                    value={operationSettings.singleColumn.operationNumber}
                                                    onChange={(e) => setOperationSettings(prev => ({
                                                        ...prev,
                                                        singleColumn: {
                                                            ...prev.singleColumn,
                                                            operationNumber: parseFloat(e.target.value)
                                                        }
                                                    }))}
                                                />
                                            </div>

                                            <div className="col-span-2">
                                                <label className="block text-sm font-medium mb-1">Prefactor (multiplier)</label>
                                                <Input
                                                    type="number"
                                                    placeholder="Enter prefactor"
                                                    value={operationSettings.singleColumn.prefactor}
                                                    onChange={(e) => setOperationSettings(prev => ({
                                                        ...prev,
                                                        singleColumn: {
                                                            ...prev.singleColumn,
                                                            prefactor: parseFloat(e.target.value)
                                                        }
                                                    }))}
                                                />
                                            </div>
                                        </div>

                                        <Button className="w-full" onClick={applySingleColumnOperation}>Apply Operation</Button>
                                    </div>
                                )}

                                {selectedColumnsForOperations.length > 1 && (
                                    <div className="space-y-4 border-t pt-4">
                                        <h3 className="font-medium">Multi-Column Operation</h3>
                                        <div className="bg-blue-50 p-4 rounded-lg mb-4">
                                            <p className="text-sm text-blue-800">
                                                Formula: {selectedColumnsForOperations.map((col, i) => {
                                                    const prefactor = operationSettings.multiColumn.prefactors[col] || 1;
                                                    const operation = operationSettings.multiColumn.operations[i - 1];
                                                    return `${i > 0 ? ` ${operation} ` : ''}${prefactor}×${col}`;
                                                }).join('')}
                                            </p>
                                        </div>

                                        {selectedColumnsForOperations.map((column, index) => (
                                            <div key={column} className="flex items-center gap-2">
                                                <span className="min-w-[120px]">{column}</span>
                                                <Input
                                                    type="number"
                                                    placeholder="Prefactor"
                                                    onChange={(e) => setOperationSettings(prev => ({
                                                        ...prev,
                                                        multiColumn: {
                                                            ...prev.multiColumn,
                                                            prefactors: {
                                                                ...prev.multiColumn.prefactors,
                                                                [column]: parseFloat(e.target.value)
                                                            }
                                                        }
                                                    }))}
                                                />
                                                {index < selectedColumnsForOperations.length - 1 && (
                                                    <select 
                                                        className="border rounded p-2"
                                                        value={operationSettings.multiColumn.operations[index] || '+'}
                                                        onChange={(e) => setOperationSettings(prev => ({
                                                            ...prev,
                                                            multiColumn: {
                                                                ...prev.multiColumn,
                                                                operations: [
                                                                    ...prev.multiColumn.operations.slice(0, index),
                                                                    e.target.value,
                                                                    ...prev.multiColumn.operations.slice(index + 1)
                                                                ]
                                                            }
                                                        }))}
                                                    >
                                                        <option value="+">Add (+)</option>
                                                        <option value="-">Subtract (-)</option>
                                                        <option value="*">Multiply (×)</option>
                                                        <option value="/">Divide (÷)</option>
                                                    </select>
                                                )}
                                            </div>
                                        ))}
                                        <Button className="w-full" onClick={applyMultiColumnOperation}>Apply Operations</Button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-sm shadow-lg rounded-full border">
                    {/* Mobile view - stacked */}
                    <div className="block sm:hidden px-4 py-2 space-y-1 text-center">
                        <div className="text-xs text-gray-600">
                            {itemsPerPage} items/page • Page {currentPage}/{Math.ceil(data.length / itemsPerPage)}
                        </div>
                        <div className="text-xs text-gray-600">
                            Total: {data.length} rows
                        </div>
                    </div>

                    {/* Desktop view - horizontal */}
                    <div className="hidden sm:flex items-center space-x-4 px-6 py-2">
                        <span className="text-sm text-gray-600">
                            {itemsPerPage} items per page
                        </span>
                        <div className="h-4 w-px bg-gray-300" />
                        <span className="text-sm text-gray-600">
                            Page {currentPage} of {Math.ceil(data.length / itemsPerPage)}
                        </span>
                        <div className="h-4 w-px bg-gray-300" />
                        <span className="text-sm text-gray-600">
                            Total rows: {data.length}
                        </span>
                    </div>
                </div>
            </AnimatePresence>
        </div>
    );
};





export default DataAnalyticsPage;
