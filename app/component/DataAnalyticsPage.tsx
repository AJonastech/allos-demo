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
    const [data, setData] = useState<any[]>([]);
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

    const handleNaNRemoval = () => {
        const allUniqueValues = new Set<string>();
        selectedColumnsForNaN.forEach(column => {
            const columnIndex = columns.indexOf(column);
            const values = data.map(row => row[columnIndex]);
            values.forEach(value => allUniqueValues.add(value));
        });
        setUniqueValues(allUniqueValues);
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
    const applyNaNRemoval = () => {
        const newData = data.filter(row => {
            return !selectedColumnsForNaN.some(column => {
                const value = row[columns.indexOf(column)];
                return selectedValues.has(value);
            });
        });
        setData(newData);
        setIsNaNModalOpen(false);
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

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div className="space-x-4">
                    <Button onClick={() => document.getElementById('fileInput')?.click()}>
                        Upload CSV
                    </Button>
                    <input
                        id="fileInput"
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleFileUpload}
                    />
                    <Button onClick={downloadCSV}>Download CSV</Button>
                    <Button onClick={() => setIsNaNModalOpen(true)}>Remove NaNs</Button>
                    <Button onClick={() => setIsDiscretizeModalOpen(true)}>Discretize Columns</Button>
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                    >
                        Previous
                    </Button>
                    <span>Page {currentPage}</span>
                    <Button
                        variant="outline"
                        onClick={() => setCurrentPage(p => p + 1)}
                        disabled={currentPage * itemsPerPage >= data.length}
                    >
                        Next
                    </Button>
                </div>
            
            </div>


            <Card>
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
            </Card>

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
                        <motion.div className="relative bg-white rounded-lg shadow-xl p-6 m-4 max-w-2xl w-full"></motion.div>
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
              
                )}

                {isDiscretizeModalOpen && (
                    <motion.div className="fixed inset-0 z-50 flex items-center justify-center">
                        <motion.div 
                            className="fixed inset-0 bg-black/30 backdrop-blur-sm"
                            onClick={() => setIsDiscretizeModalOpen(false)}
                        />
                        <motion.div className="relative bg-white rounded-lg shadow-xl p-6 m-4 max-w-2xl w-full"></motion.div>
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
                    
                )}
            </AnimatePresence>
        </div>
    );
};

export default DataAnalyticsPage;
