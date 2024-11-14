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
import * as XLSX from 'xlsx'
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ColumnStats {
    name: string;
    uniqueValues: { value: string; count: number }[];
    type: 'discrete' | 'continuous' | 'index';
}

const DataAnalyticsPage = () => {
    const [data, setData] = useState<string[][]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [selectedColumn, setSelectedColumn] = useState<ColumnStats | null>(null);
    const [isColumnDialogOpen, setIsColumnDialogOpen] = useState(false);
    const [newColumnName, setNewColumnName] = useState('');
    const [isNaNModalOpen, setIsNaNModalOpen] = useState(false);
    const [isDiscretizeModalOpen, setIsDiscretizeModalOpen] = useState(false);
    const [selectedColumnsForNaN, setSelectedColumnsForNaN] = useState<string[]>([]);
    const [uniqueValues, setUniqueValues] = useState<Set<string>>(new Set());
    const [selectedValues, setSelectedValues] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState<string>('');
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
    const [isRelabelModalOpen, setIsRelabelModalOpen] = useState(false);
    const [selectedColumnsForRelabel, setSelectedColumnsForRelabel] = useState<string[]>([]);
    const [relabelMappings, setRelabelMappings] = useState<Record<string, {
        uniqueValues: string[],
        newLabels: string,
        hasEmptyCells?: boolean
    }>>({});

    const itemsPerPage = 50;

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const fileExtension = file.name.split('.').pop()?.toLowerCase();

        if (fileExtension === 'csv') {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                const rows = text.split('\n')
                    .filter(line => line.trim() !== '')
                    .map(row => row.split(','));
                setColumns(rows[0]);
                setData(rows.slice(1));
            };
            reader.readAsText(file);
        } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as string[][];

                if (jsonData.length > 0) {
                    setColumns(jsonData[0]);
                    setData(jsonData.slice(1));
                }
            };
            reader.readAsArrayBuffer(file);
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



    // const handleNaNRemoval = () => {
    //     const allUniqueValues = new Set<string>();
    //     selectedColumnsForNaN.forEach(column => {
    //         const columnIndex = columns.indexOf(column);
    //         const values = data.map(row => {
    //             const value = row[columnIndex];
    //             // Convert potential number strings to actual numbers for comparison
    //             return isNaN(Number(value)) ? value : Number(value).toString();
    //         });
    //         values.forEach(value => allUniqueValues.add(value));
    //     });
    //     setUniqueValues(allUniqueValues);
    // };

    const applyNaNRemoval = () => {
        // First filter out rows containing selected values
        const newData = data.filter(row => {
            return !selectedColumnsForNaN.some(column => {
                const columnIndex = columns.indexOf(column);
                const value = row[columnIndex];
                // Convert value to string for consistent comparison
                const normalizedValue = value === undefined || value === null || value === '' ? 'NaN' :
                    isNaN(Number(value)) ? value : Number(value).toString();
                return selectedValues.has(normalizedValue);
            });
        });

        // Then only keep the selected columns
        const selectedColumnIndices = selectedColumnsForNaN.map(col => columns.indexOf(col));
        const filteredColumns = selectedColumnsForNaN;
        const filteredData = newData.map(row =>
            selectedColumnIndices.map(index => row[index])
        );

        setColumns(filteredColumns);
        setData(filteredData);
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

    const discretizeColumns = (columnsToDiscretize: string[]) => {
        let newData = [...data];

        columnsToDiscretize.forEach(columnName => {
            const settings = binSettings[columnName];
            const columnIndex = columns.indexOf(columnName);
            const values = newData.map(row => parseFloat(row[columnIndex]));
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

            newData = newData.map(row => {
                const value = parseFloat(row[columnIndex]);
                const binIndex = bins.findIndex((bin, i) => value >= bin && (!bins[i + 1] || value < bins[i + 1]));
                return [...row.slice(0, columnIndex), binIndex.toString(), ...row.slice(columnIndex + 1)];
            });
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

const newColumnName = selectedColumnsForOperations.map((col, id)=>{
const operation =operations[id-1]
const prefactor = prefactors[col] || 1

return `${id >0 ? operation :""}${prefactor}${col}`
}).join(" ")

const newColumns =[...columns, newColumnName]
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

            return [...row,  isNaN(result) ? "NaN" :result.toString()]
        });

        setData(newData);  
        setColumns(newColumns)
        setIsColumnOperationsOpen(false);
    };
    

    const getUniqueValuesForColumn = (columnName: string) => {
        const columnIndex = columns.indexOf(columnName);
        return [...new Set(data.map(row => row[columnIndex]))];
    };

    const handleRelabelUpdate = () => {
        let newData = [...data];

        selectedColumnsForRelabel.forEach(column => {
            const columnIndex = columns.indexOf(column);
            const mapping = relabelMappings[column];

            if (!mapping || !mapping.newLabels) return;

            const labels = mapping.newLabels.split(',').map(l => l.trim());
            if (labels.length !== mapping.uniqueValues.length) return;

            const valueToLabel = Object.fromEntries(
                mapping.uniqueValues.map((value, i) => [value, labels[i]])
            );

            newData = newData.map(row => {
                const newRow = [...row];
                newRow[columnIndex] = valueToLabel[row[columnIndex]] || row[columnIndex];
                return newRow;
            });
        });

        setData(newData);
        setIsRelabelModalOpen(false);
        setSelectedColumnsForRelabel([]);
        setRelabelMappings({});
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
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                        onChange={handleFileUpload}
                    />
                    <Button
                        className="w-full sm:w-auto"
                        disabled={data.length === 0}
                        onClick={downloadCSV}
                    >
                        <span className="hidden sm:inline">Download CSV</span>
                        <span className="sm:hidden">Download</span>
                    </Button>
                    <Button
                        className="w-full sm:w-auto"
                        disabled={data.length === 0}
                        onClick={() => setIsNaNModalOpen(true)}
                    >
                        <span className="hidden sm:inline">Remove NaNs</span>
                        <span className="sm:hidden">NaNs</span>
                    </Button>
                    <Button
                        className="w-full sm:w-auto"
                        disabled={data.length === 0}
                        onClick={() => setIsDiscretizeModalOpen(true)}
                    >
                        <span className="hidden sm:inline">Discretize Columns</span>
                        <span className="sm:hidden">Discretize</span>
                    </Button>
                    <Button
                        className="w-full sm:w-auto"
                        disabled={data.length === 0}
                        onClick={() => setIsRelabelModalOpen(true)}
                    >
                        <span className="hidden sm:inline">Relabel Values</span>
                        <span className="sm:hidden">Relabel</span>
                    </Button>
                    <Button
                        className="w-full sm:w-auto"
                        disabled={data.length === 0}
                        onClick={() => setIsColumnOperationsOpen(true)}
                    >
                        <span className="hidden sm:inline">Column Operations</span>
                        <span className="sm:hidden">Operations</span>
                    </Button>
                </div>


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
            ) : <Card>
                <CardHeader>
                    <CardTitle>Data Preview</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="w-full overflow-auto">

                        <div className="w-full  h-[600px] overflow-y-scroll">
                            <Table className="min-w-max">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="bg-slate-50 sticky left-0 z-20">ALLOS ID</TableHead>
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
                                                <TableCell className="bg-slate-50 sticky left-0">{(currentPage - 1) * itemsPerPage + rowIndex + 1}</TableCell>
                                                {row.map((cell: string, cellIndex: number) => (
                                                    <TableCell key={cellIndex}>{cell}</TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                </TableBody>
                            </Table>
                        </div>

                    </div>
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
                    <motion.div className="fixed  inset-0 z-50 flex items-center justify-center">
                        <motion.div
                            className="fixed inset-0 bg-black/30 backdrop-blur-sm"
                            onClick={() => setIsNaNModalOpen(false)}
                        />
                        <motion.div className="relative max-h-[90vh] h-[80vh] overflow-auto bg-white rounded-lg shadow-xl p-6 m-4 max-w-2xl w-full">
                            <h2 className="text-xl font-semibold mb-4">Remove Values</h2>

                            {uniqueValues.size === 0 ? (
                                <>
                                    <div className="bg-blue-50 p-4 rounded-lg mb-6">
                                        <h4 className="font-medium text-blue-800 mb-2">How to use:</h4>
                                        <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
                                            <li>First, select one or more columns you want to clean</li>
                                            <li>Click &apos;Show Unique Values&apos; to see all values in selected columns</li>
                                            <li>Check the boxes next to values you want to remove</li>
                                            <li>Click &apos;Apply Removal&apos; to remove rows containing selected values</li>
                                        </ol>
                                    </div>

                                    <div>
                                        <h3 className="font-medium mb-2">Select Columns to Clean:</h3>
                                        <div className="flex flex-col space-y-4">
                                            <Input
                                                type="text"
                                                placeholder="Search columns..."
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="pl-8"
                                            />
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    className="text-xs"
                                                    onClick={() => setSelectedColumnsForNaN(columns)}
                                                >
                                                    Select All
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="text-xs"
                                                    onClick={() => setSelectedColumnsForNaN([])}
                                                >
                                                    Clear All
                                                </Button>
                                            </div>
                                            <ScrollArea className="h-[200px] border rounded-md p-2 mt-2">
                                                {columns
                                                    .filter(col => col.toLowerCase().includes(searchTerm.toLowerCase()))
                                                    .map((column, id) => (
                                                        <div
                                                            key={id}
                                                            className={`
                                                                flex items-center justify-between p-2 rounded
                                                                ${selectedColumnsForNaN.includes(column)
                                                                    ? 'bg-blue-50 hover:bg-blue-100'
                                                                    : 'hover:bg-gray-100'
                                                                }
                                                                cursor-pointer
                                                            `}
                                                            onClick={() => {
                                                                setSelectedColumnsForNaN(prev =>
                                                                    prev.includes(column)
                                                                        ? prev.filter(c => c !== column)
                                                                        : [...prev, column]
                                                                );
                                                            }}
                                                        >
                                                            <div className="flex items-center space-x-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedColumnsForNaN.includes(column)}
                                                                    onChange={() => { }} // Handled by parent onClick
                                                                    className="rounded border-gray-300"
                                                                />
                                                                <span className="truncate">{column}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                            </ScrollArea>



                                        </div>

                                        {selectedColumnsForNaN.length > 0 && (
                                            <Button
                                                className="w-full mt-4"
                                                onClick={() => {
                                                    const allUniqueValues = new Set<string>();
                                                    selectedColumnsForNaN.forEach(column => {
                                                        const columnIndex = columns.indexOf(column);
                                                        const values = data.map(row => {
                                                            const value = row[columnIndex];
                                                            // Handle null, undefined, or empty values
                                                            if (!value) return 'NaN';
                                                            // Convert to string and check if it's empty after trimming
                                                            const strValue = String(value);
                                                            if (strValue.trim() === '') return 'NaN';
                                                            // Handle numeric values
                                                            const numValue = Number(value);
                                                            if (!isNaN(numValue)) return numValue.toString();
                                                            // Return original value as string
                                                            return strValue;
                                                        });
                                                        values.forEach(value => {
                                                            if (value) allUniqueValues.add(value);
                                                        });
                                                    });
                                                    setUniqueValues(allUniqueValues);
                                                }}
                                            >
                                                Show Unique Values
                                            </Button>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className='h-[calc(100vh-20rem)] flex flex-col'>
                                    <Button
                                        variant="outline"
                                        onClick={() => setUniqueValues(new Set())}
                                        className="shrink-0"
                                    >
                                        ← Back to Column Selection
                                    </Button>
                                    <div className="my-2">
                                        <Input
                                            type="text"
                                            placeholder="Search values..."
                                            className="w-full"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value.toLowerCase())}
                                        />
                                    </div>
                                    {selectedValues.size > 0 && (


                                        <div className="mt-0 shrink-0 mb-2">
                                            <div className="bg-yellow-50 p-3 rounded-lg">
                                                <p className="text-sm text-yellow-800">
                                                    ⚠️ This will remove rows containing the selected values.
                                                    This action cannot be undone.
                                                </p>
                                            </div>
                                        </div>)}

                                    <div className="mt-4 flex-1 min-h-0">
                                        <ScrollArea className="h-full border rounded-lg">
                                            {Array.from(uniqueValues)
                                                .filter((value: string) => value.toString().toLowerCase().includes(searchTerm))
                                                .map((value: string, id: number) => (
                                                    <div key={id} className="flex items-center space-x-2 p-2 hover:bg-gray-50">
                                                        <input
                                                            type="checkbox"
                                                            id={`value-${value}`}
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
                                                            className="h-4 w-4 rounded border-gray-300"
                                                        />
                                                        <label htmlFor={`value-${value}`} className="flex-grow cursor-pointer">
                                                            {value === 'NaN' ? 'NaN (empty or invalid values)' : value}
                                                        </label>
                                                    </div>
                                                ))}
                                        </ScrollArea>
                                    </div>


                                    {selectedValues.size > 0 && (
                                        <Button
                                            onClick={applyNaNRemoval}
                                            className="w-full mt-4 shrink-0"
                                        >
                                            Remove Selected Values
                                        </Button>
                                    )}
                                </div>
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
                        <motion.div className="relative max-h-[90vh] h-[80vh] overflow-auto bg-white rounded-lg shadow-xl p-6 m-4 max-w-2xl w-full">
                            <h2 className="text-xl font-semibold mb-4">Column Operations</h2>

                            <div className="bg-blue-50 p-4 rounded-lg mb-6">
                                <h4 className="font-medium text-blue-800 mb-2">How to use:</h4>
                                <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
                                    <li>Select one column for single operations or multiple columns for combined operations</li>
                                    <li>For single column: choose operation type and parameters</li>
                                    <li>For multiple columns: set prefactors and operations between columns</li>
                                    <li>Preview the formula before applying changes</li>
                                </ol>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <h3 className="font-medium mb-2">Select Columns:</h3>
                                    <Input
                                        type="text"
                                        placeholder="Search columns..."
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="mb-2"
                                    />
                                    <div className="flex gap-2 mb-2">
                                        <Button
                                            variant="outline"
                                            className="text-xs"
                                            onClick={() => setSelectedColumnsForOperations(columns)}
                                        >
                                            Select All
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="text-xs"
                                            onClick={() => setSelectedColumnsForOperations([])}
                                        >
                                            Clear All
                                        </Button>
                                    </div>
                                    <ScrollArea className="h-[200px] border rounded-md p-2">
                                        {columns
                                            .filter(col => col.toLowerCase().includes(searchTerm.toLowerCase()))
                                            .map((column, id) => (
                                                <div
                                                    key={id}
                                                    className={`
                                                    flex items-center justify-between p-2 rounded
                                                    ${selectedColumnsForOperations.includes(column)
                                                            ? 'bg-blue-50 hover:bg-blue-100'
                                                            : 'hover:bg-gray-100'
                                                        }
                                                    cursor-pointer
                                                `}
                                                    onClick={() => {
                                                        setSelectedColumnsForOperations(prev =>
                                                            prev.includes(column)
                                                                ? prev.filter(c => c !== column)
                                                                : [...prev, column]
                                                        );
                                                    }}
                                                >
                                                    <div className="flex items-center space-x-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedColumnsForOperations.includes(column)}
                                                            onChange={() => { }} // Handled by parent onClick
                                                            className="rounded border-gray-300"
                                                        />
                                                        <span className="truncate">{column}</span>
                                                    </div>
                                                </div>
                                            ))}
                                    </ScrollArea>
                                </div>

                                {selectedColumnsForOperations.length > 0 && (
                                    <div className="space-y-4 border-t pt-4">
                                        {selectedColumnsForOperations.length === 1 ? (
                                            <>
                                                <h3 className="font-medium">Single Column Operation</h3>
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
                                                                    operation: e.target.value as 'power' | 'exponential' | 'logarithm'
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
                                                </div>
                                                <Button
                                                    className="w-full mt-4"
                                                    onClick={applySingleColumnOperation}
                                                >
                                                    Apply Operation
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <h3 className="font-medium">Multi-Column Operation</h3>
                                                <ScrollArea className="h-[200px]">
                                                    {selectedColumnsForOperations.map((column, index) => (
                                                        <div key={column} className="flex items-center gap-2 mb-2">
                                                            <span className="min-w-[120px] truncate">{column}</span>
                                                            <Input
                                                                type="number"
                                                                placeholder="Prefactor"
                                                                className="w-24"
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
                                                                    value={operationSettings.multiColumn.operations[index]}
                                                                    onChange={(e) => {
                                                                        const newOperations = [...operationSettings.multiColumn.operations];
                                                                        newOperations[index] = e.target.value;
                                                                        setOperationSettings(prev => ({
                                                                            ...prev,
                                                                            multiColumn: {
                                                                                ...prev.multiColumn,
                                                                                operations: newOperations
                                                                            }
                                                                        }));
                                                                    }}
                                                                >
                                                                    <option value="+">Add (+)</option>
                                                                    <option value="-">Subtract (-)</option>
                                                                    <option value="*">Multiply (×)</option>
                                                                    <option value="/">Divide (÷)</option>
                                                                </select>
                                                            )}
                                                        </div>
                                                    ))}
                                                </ScrollArea>
                                                <Button
                                                    className="w-full mt-4"
                                                    onClick={applyMultiColumnOperation}
                                                >
                                                    Apply Operations
                                                </Button>
                                            </>
                                        )}
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
                        <motion.div className="relative bg-white rounded-lg shadow-xl p-6 m-4 max-w-2xl w-full max-h-[90vh] h-[90vh] overflow-y-auto">
                            <h2 className="text-xl font-semibold mb-4">Discretize Columns</h2>

                            {Object.keys(binSettings).length === 0 ? (
                                <>
                                    <div className="bg-blue-50 p-4 rounded-lg mb-6">
                                        <h4 className="font-medium text-blue-800 mb-2">How to discretize:</h4>
                                        <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
                                            <li>Select continuous columns you want to discretize</li>
                                            <li>Click &apos;Configure Binning&apos; to set up discretization for each column</li>
                                            <li>Choose binning method and parameters for each selected column</li>
                                            <li>Apply the transformation to your data</li>
                                        </ol>
                                    </div>

                                    <div>
                                        <h3 className="font-medium mb-2">Select Columns:</h3>
                                        <Input
                                            type="text"
                                            placeholder="Search columns..."
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="mb-2"
                                        />
                                        <div className="flex gap-2 mb-2">
                                            <Button
                                                variant="outline"
                                                className="text-xs"
                                                onClick={() => setSelectedColumnsForDiscretize(
                                                    columns.filter((_, index) => getColumnType(index) === 'continuous')
                                                )}
                                            >
                                                Select All Continuous
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="text-xs"
                                                onClick={() => setSelectedColumnsForDiscretize([])}
                                            >
                                                Clear All
                                            </Button>
                                        </div>
                                        <ScrollArea className="h-[300px] border rounded-md p-2">
                                            {columns
                                                .filter(col => col.toLowerCase().includes(searchTerm.toLowerCase()))
                                                .map((column, index) => {
                                                    const type = getColumnType(index);
                                                    return (
                                                        <div
                                                            key={index}
                                                            className={`
                                                flex items-center justify-between p-2 rounded
                                                ${type !== 'continuous' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                                ${selectedColumnsForDiscretize.includes(column) ? 'bg-blue-50' : 'hover:bg-gray-100'}
                                            `}
                                                            onClick={() => {
                                                                if (type === 'continuous') {
                                                                    setSelectedColumnsForDiscretize(prev =>
                                                                        prev.includes(column)
                                                                            ? prev.filter(c => c !== column)
                                                                            : [...prev, column]
                                                                    );
                                                                }
                                                            }}
                                                        >
                                                            <div className="flex items-center space-x-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedColumnsForDiscretize.includes(column)}
                                                                    disabled={type !== 'continuous'}
                                                                    onChange={() => { }}
                                                                    className="rounded border-gray-300"
                                                                />
                                                                <span>{column}</span>
                                                            </div>
                                                            <span className="text-sm text-gray-500">{type}</span>
                                                        </div>
                                                    );
                                                })}
                                        </ScrollArea>

                                        {selectedColumnsForDiscretize.length > 0 && (
                                            <Button
                                                className="w-full mt-4"
                                                onClick={() => {
                                                    const initialSettings: Record<string, { type: 'size' | 'count' | 'custom', value: number | number[] }> = {};
                                                    selectedColumnsForDiscretize.forEach(column => {
                                                        initialSettings[column] = {
                                                            type: 'size',
                                                            value: 1
                                                        };
                                                    });
                                                    setBinSettings(initialSettings);
                                                }}
                                            >
                                                Configure Binning ({selectedColumnsForDiscretize.length} columns)
                                            </Button>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-6">
                                    <Button
                                        variant="outline"
                                        onClick={() => setBinSettings({})}
                                        className="mb-4"
                                    >
                                        ← Back to Column Selection
                                    </Button>

                                    {selectedColumnsForDiscretize.map((column, id) => (
                                        <div key={id} className="border p-4 rounded-lg">
                                            <h3 className="font-medium mb-4">{column}</h3>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-sm font-medium mb-1 block">Binning Method</label>
                                                    <Select
                                                        value={binSettings[column]?.type}
                                                        onValueChange={(value) => setBinSettings(prev => ({
                                                            ...prev,
                                                            [column]: { ...prev[column], type: value as 'size' | 'count' | 'custom' }
                                                        }))}
                                                    >
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="Select binning method" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="size">Fixed Bin Size</SelectItem>
                                                            <SelectItem value="count">Number of Bins</SelectItem>
                                                            <SelectItem value="custom">Custom Boundaries</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>


                                                {binSettings[column]?.type === 'size' && (
                                                    <Input
                                                        type="number"
                                                        placeholder="Enter size of each bin"
                                                        value={Array.isArray(binSettings[column].value) ? binSettings[column].value.join(',') : binSettings[column].value.toString()}
                                                        onChange={(e) => setBinSettings(prev => ({
                                                            ...prev,
                                                            [column]: { ...prev[column], value: parseFloat(e.target.value) }
                                                        }))}
                                                    />
                                                )}

                                                {binSettings[column]?.type === 'count' && (
                                                    <Input
                                                        type="number"
                                                        placeholder="Enter number of bins"
                                                        value={Array.isArray(binSettings[column].value) ? binSettings[column].value.join(',') : binSettings[column].value.toString()}
                                                        onChange={(e) => setBinSettings(prev => ({
                                                            ...prev,
                                                            [column]: { ...prev[column], value: parseFloat(e.target.value) }
                                                        }))}
                                                    />
                                                )}

                                                {binSettings[column]?.type === 'custom' && (
                                                    <div>
                                                        <Input
                                                            placeholder="e.g., 0,10,20,30,40"
                                                         
                                                            onChange={(e) => setBinSettings(prev => ({
                                                                ...prev,
                                                                [column]: {
                                                                    type: 'custom',
                                                                    value: e.target.value.split(',').map(Number)
                                                                }
                                                            }))}
                                                        />
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            Enter comma-separated values for bin boundaries
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                        </div>

                                    ))}

                                    <Button
                                    className='w-full'
                                    onClick={() => {
                                        discretizeColumns(selectedColumnsForDiscretize);
                                        setIsDiscretizeModalOpen(false);
                                        setBinSettings({});
                                        setSelectedColumnsForDiscretize([]);

                                    }}
                                    >
                                        Apply Discretization
                                    </Button>
                                </div>)}

                        </motion.div>
                    </motion.div>
                )},
                
               
                {isRelabelModalOpen && (
                    <motion.div className="fixed inset-0 z-50 flex items-center justify-center">
                        <motion.div
                            className="fixed inset-0 bg-black/30 backdrop-blur-sm"
                            onClick={() => setIsRelabelModalOpen(false)}
                        />
                        <motion.div className="relative bg-white rounded-lg shadow-xl p-6 m-4 max-w-2xl w-full max-h-[90vh] h-[90vh] overflow-y-auto">
                            <h2 className="text-xl font-semibold mb-4">Relabel Values</h2>

                            {Object.keys(relabelMappings).length === 0 ? (
                                <>
                                    <div className="bg-blue-50 p-4 rounded-lg mb-6">
                                        <h4 className="font-medium text-blue-800 mb-2">How to relabel:</h4>
                                        <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
                                            <li>Select columns you want to relabel values for</li>
                                            <li>Click &apos;Configure Relabeling&apos; to set up new labels</li>
                                            <li>For each column, specify new labels for existing values</li>
                                            <li>Apply the changes to update your data</li>
                                        </ol>
                                    </div>

                                    <div>
                                        <h3 className="font-medium mb-2">Select Columns:</h3>
                                        <Input
                                            type="text"
                                            placeholder="Search columns..."
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="mb-2"
                                        />
                                        <div className="flex gap-2 mb-2">
                                            <Button
                                                variant="outline"
                                                className="text-xs"
                                                onClick={() => setSelectedColumnsForRelabel(columns)}
                                            >
                                                Select All
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="text-xs"
                                                onClick={() => setSelectedColumnsForRelabel([])}
                                            >
                                                Clear All
                                            </Button>
                                        </div>
                                        <ScrollArea className="h-[300px] border rounded-md p-2">
                                            {columns
                                                .filter(col => col.toLowerCase().includes(searchTerm.toLowerCase()))
                                                .map((column, index) => (
                                                    <div
                                                        key={index}
                                                        className={`
                                                            flex items-center justify-between p-2 rounded
                                                            cursor-pointer
                                                            ${selectedColumnsForRelabel.includes(column) ? 'bg-blue-50' : 'hover:bg-gray-100'}
                                                        `}
                                                        onClick={() => {
                                                            setSelectedColumnsForRelabel(prev =>
                                                                prev.includes(column)
                                                                    ? prev.filter(c => c !== column)
                                                                    : [...prev, column]
                                                            );
                                                        }}
                                                    >
                                                        <div className="flex items-center space-x-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedColumnsForRelabel.includes(column)}
                                                                onChange={() => {}}
                                                                className="rounded border-gray-300"
                                                            />
                                                            <span>{column}</span>
                                                        </div>
                                                        
                                                    </div>
                                                ))}
                                        </ScrollArea>

                                        {selectedColumnsForRelabel.length > 0 && (
                                            <Button
                                                className="w-full mt-4"
                                                onClick={() => {
                                                    const initialMappings: Record<string, {
                                                        uniqueValues: string[],
                                                        newLabels: string,
                                                        hasEmptyCells?: boolean
                                                    }> = {};
                                                    selectedColumnsForRelabel.forEach(column => {
                                                        const uniqueValues = getUniqueValuesForColumn(column);
                                                        const hasEmptyCells = uniqueValues.some(v => {
                                                            if (v === null || v === undefined) return true;
                                                            const strValue = String(v);
                                                            return !strValue || strValue.trim() === '';
                                                        });
                                                        initialMappings[column] = {
                                                            uniqueValues,
                                                            newLabels: '',
                                                            hasEmptyCells
                                                        };
                                                    });
                                                    setRelabelMappings(initialMappings);
                                                }}
                                            >
                                                Configure Relabeling ({selectedColumnsForRelabel.length} columns)
                                            </Button>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-6">
                                    <Button
                                        variant="outline"
                                        onClick={() => setRelabelMappings({})}
                                        className="mb-4"
                                    >
                                        ← Back to Column Selection
                                    </Button>

                                    {selectedColumnsForRelabel.map((column, index) => (
                                        <div key={index} className="border p-4 rounded-lg">
                                            <h3 className="font-medium mb-4">{column}</h3>
                                            {relabelMappings[column]?.hasEmptyCells && (
                                                <div className="mb-4 bg-yellow-50 p-4 rounded-lg">
                                                    <p className="text-sm text-yellow-700">
                                                        ⚠️ This column contains empty cells
                                                    </p>
                                                </div>
                                            )}
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-medium mb-2">
                                                        Current Values: {relabelMappings[column]?.uniqueValues.join(', ')}
                                                    </label>
                                                    <Input
                                                        placeholder="Enter new labels (comma-separated)"
                                                        value={relabelMappings[column]?.newLabels || ''}
                                                        onChange={(e) => setRelabelMappings(prev => ({
                                                            ...prev,
                                                            [column]: {
                                                                ...prev[column],
                                                                newLabels: e.target.value
                                                            }
                                                        }))}
                                                    />
                                                   
                                                </div>
                                                <p className="text-sm text-gray-500 mt-1">
                                                        {(() => {
                                                            const mapping = relabelMappings[column];
                                                            const currentLabels = mapping?.newLabels ? mapping.newLabels.split(',').map(l => l.trim()) : [];
                                                            const isLabelCountMismatch = currentLabels.length !== mapping?.uniqueValues.length;

                                                            if (isLabelCountMismatch) {
                                                                return (
                                                                    <motion.div
                                                                        initial={{ opacity: 0, y: -10 }}
                                                                        animate={{ opacity: 1, y: 0 }}
                                                                        className="text-red-500 flex items-center gap-1"
                                                                    >
                                                                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                                        </svg>
                                                                        Please enter exactly {mapping?.uniqueValues.length} labels (currently have {currentLabels.length})
                                                                    </motion.div>
                                                                );
                                                            }

                                                            return `Enter ${mapping?.uniqueValues.length} comma-separated values`;
                                                        })()}
                                                    </p>
                                            </div>
                                        </div>
                                    ))}

                                    <Button
                                        className="w-full"
                                        onClick={handleRelabelUpdate}
                                    >
                                        Apply Relabeling
                                    </Button>
                                </div>
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
                        <motion.div className="relative bg-white rounded-lg shadow-xl p-6 m-4 max-w-2xl w-full max-h-[90vh] h-[90vh] overflow-y-auto">
                            <h2 className="text-xl font-semibold mb-4">Column Operations</h2>

                            {Object.keys(operationSettings.multiColumn.prefactors).length === 0 ? (
                                <>
                                    <div className="bg-blue-50 p-4 rounded-lg mb-6">
                                        <h4 className="font-medium text-blue-800 mb-2">How to perform operations:</h4>
                                        <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
                                            <li>Select columns you want to perform operations on</li>
                                            <li>Choose single column operation for one column</li>
                                            <li>Choose multi-column operation for combining columns</li>
                                            <li>Apply the transformation to your data</li>
                                        </ol>
                                    </div>

                                    <div>
                                        <h3 className="font-medium mb-2">Select Columns:</h3>
                                        <Input
                                            type="text"
                                            placeholder="Search columns..."
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="mb-2"
                                        />
                                        <div className="flex gap-2 mb-2">
                                            <Button
                                                variant="outline"
                                                className="text-xs"
                                                onClick={() => setSelectedColumnsForOperations(columns)}
                                            >
                                                Select All
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="text-xs"
                                                onClick={() => setSelectedColumnsForOperations([])}
                                            >
                                                Clear All
                                            </Button>
                                        </div>
                                        <ScrollArea className="h-[300px] border rounded-md p-2">
                                            {columns
                                                .filter(col => col.toLowerCase().includes(searchTerm.toLowerCase()))
                                                .map((column, index) => (
                                                    <div
                                                        key={index}
                                                        className={`
                                                            flex items-center justify-between p-2 rounded
                                                            cursor-pointer
                                                            ${selectedColumnsForOperations.includes(column) ? 'bg-blue-50' : 'hover:bg-gray-100'}
                                                        `}
                                                        onClick={() => {
                                                            setSelectedColumnsForOperations(prev =>
                                                                prev.includes(column)
                                                                    ? prev.filter(c => c !== column)
                                                                    : [...prev, column]
                                                            );
                                                        }}
                                                    >
                                                        <div className="flex items-center space-x-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedColumnsForOperations.includes(column)}
                                                                onChange={() => {}}
                                                                className="rounded border-gray-300"
                                                            />
                                                            <span>{column}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                        </ScrollArea>

                                        {selectedColumnsForOperations.length > 0 && (
                                            <Button
                                                className="w-full mt-4"
                                                onClick={() => {
                                                    const initialPrefactors: Record<string, number> = {};
                                                    const initialOperations: string[] = [];
                                                    selectedColumnsForOperations.forEach((column, index) => {
                                                        initialPrefactors[column] = 1;
                                                        if (index < selectedColumnsForOperations.length - 1) {
                                                            initialOperations.push('+');
                                                        }
                                                    });
                                                    setOperationSettings(prev => ({
                                                        ...prev,
                                                        multiColumn: {
                                                            prefactors: initialPrefactors,
                                                            operations: initialOperations
                                                        }
                                                    }));
                                                }}
                                            >
                                                Configure Operations ({selectedColumnsForOperations.length} columns)
                                            </Button>
                                        )}
                                    </div>
                                </>
                            ) : (
                                // Your existing operation settings UI here
                                <div className="space-y-6">
                                    <Button
                                        variant="outline"
                                        onClick={() => setOperationSettings(prev => ({
                                            ...prev,
                                            multiColumn: { prefactors: {}, operations: [] }
                                        }))}
                                        className="mb-4"
                                    >
                                        ← Back to Column Selection
                                        </Button>
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
                                                            operation: e.target.value as 'power' | 'exponential' | 'logarithm'
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
                            )}
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